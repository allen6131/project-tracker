const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireActive } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireActive);

// GET /api/catalog-materials - Get all catalog materials
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const activeOnly = req.query.active_only !== 'false'; // Default to true

    let query = `
      SELECT g.*, u.username as created_by_username
      FROM global_materials_catalog g
      LEFT JOIN users u ON g.created_by = u.id
    `;
    let countQuery = 'SELECT COUNT(*) FROM global_materials_catalog g';
    let queryParams = [];
    let countParams = [];
    let whereConditions = [];

    // Add active filter
    if (activeOnly) {
      whereConditions.push('g.is_active = true');
    }

    // Add search filter
    if (search) {
      whereConditions.push(`(g.name ILIKE $${queryParams.length + 1} OR g.description ILIKE $${queryParams.length + 1} OR g.part_number ILIKE $${queryParams.length + 1})`);
      queryParams.push(`%${search}%`);
      countParams.push(`%${search}%`);
    }

    // Add category filter
    if (category) {
      whereConditions.push(`g.category = $${queryParams.length + 1}`);
      queryParams.push(category);
      countParams.push(category);
    }

    // Apply WHERE conditions
    if (whereConditions.length > 0) {
      const whereClause = ' WHERE ' + whereConditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY g.category ASC, g.name ASC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const [materialsResult, countResult] = await Promise.all([
      req.app.locals.db.query(query, queryParams),
      req.app.locals.db.query(countQuery, countParams)
    ]);

    const totalMaterials = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalMaterials / limit);

    // Convert decimal values to numbers
    const materials = materialsResult.rows.map(material => ({
      ...material,
      standard_cost: parseFloat(material.standard_cost) || 0
    }));

    res.json({
      materials,
      pagination: {
        currentPage: page,
        totalPages,
        totalMaterials,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get catalog materials error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/catalog-materials/categories - Get all categories
router.get('/categories', async (req, res) => {
  try {
    const result = await req.app.locals.db.query(
      'SELECT DISTINCT category FROM global_materials_catalog WHERE category IS NOT NULL AND is_active = true ORDER BY category ASC'
    );

    res.json({ categories: result.rows.map(row => row.category) });

  } catch (error) {
    console.error('Get material categories error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/catalog-materials - Create new catalog material (admin only)
router.post('/', requireAdmin, [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category must not exceed 100 characters'),
  body('unit')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Unit must not exceed 50 characters'),
  body('standard_cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Standard cost must be a positive number'),
  body('supplier')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Supplier must not exceed 255 characters'),
  body('part_number')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Part number must not exceed 100 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      name, 
      description, 
      category, 
      unit = 'each', 
      standard_cost = 0, 
      supplier, 
      part_number, 
      notes 
    } = req.body;

    const result = await req.app.locals.db.query(
      `INSERT INTO global_materials_catalog 
        (name, description, category, unit, standard_cost, supplier, part_number, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [name, description || null, category || null, unit, standard_cost, supplier || null, part_number || null, notes || null, req.user.userId]
    );

    const material = {
      ...result.rows[0],
      standard_cost: parseFloat(result.rows[0].standard_cost) || 0
    };

    res.status(201).json({
      message: 'Catalog material created successfully',
      material
    });

  } catch (error) {
    console.error('Create catalog material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/catalog-materials/:id - Get specific catalog material
router.get('/:id', async (req, res) => {
  try {
    const materialId = parseInt(req.params.id);
    
    if (isNaN(materialId)) {
      return res.status(400).json({ message: 'Invalid material ID' });
    }

    const result = await req.app.locals.db.query(
      `SELECT g.*, u.username as created_by_username
       FROM global_materials_catalog g
       LEFT JOIN users u ON g.created_by = u.id
       WHERE g.id = $1`,
      [materialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Material not found' });
    }

    const material = {
      ...result.rows[0],
      standard_cost: parseFloat(result.rows[0].standard_cost) || 0
    };

    res.json({ material });

  } catch (error) {
    console.error('Get catalog material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/catalog-materials/:id - Update catalog material (admin only)
router.put('/:id', requireAdmin, [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category must not exceed 100 characters'),
  body('unit')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Unit must not exceed 50 characters'),
  body('standard_cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Standard cost must be a positive number'),
  body('supplier')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Supplier must not exceed 255 characters'),
  body('part_number')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Part number must not exceed 100 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const materialId = parseInt(req.params.id);
    
    if (isNaN(materialId)) {
      return res.status(400).json({ message: 'Invalid material ID' });
    }

    const { 
      name, 
      description, 
      category, 
      unit, 
      standard_cost, 
      supplier, 
      part_number, 
      notes,
      is_active 
    } = req.body;

    const result = await req.app.locals.db.query(
      `UPDATE global_materials_catalog 
       SET name = $1, description = $2, category = $3, unit = $4, standard_cost = $5, 
           supplier = $6, part_number = $7, notes = $8, is_active = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 
       RETURNING *`,
      [name, description || null, category || null, unit, standard_cost, supplier || null, 
       part_number || null, notes || null, is_active !== undefined ? is_active : true, materialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Material not found' });
    }

    const material = {
      ...result.rows[0],
      standard_cost: parseFloat(result.rows[0].standard_cost) || 0
    };

    res.json({
      message: 'Catalog material updated successfully',
      material
    });

  } catch (error) {
    console.error('Update catalog material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/catalog-materials/:id - Delete catalog material (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const materialId = parseInt(req.params.id);
    
    if (isNaN(materialId)) {
      return res.status(400).json({ message: 'Invalid material ID' });
    }

    const result = await req.app.locals.db.query(
      'DELETE FROM global_materials_catalog WHERE id = $1 RETURNING id, name',
      [materialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Material not found' });
    }

    res.json({
      message: 'Catalog material deleted successfully',
      deletedMaterial: result.rows[0]
    });

  } catch (error) {
    console.error('Delete catalog material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 