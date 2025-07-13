const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { body, validationResult, query } = require('express-validator');

// Get all services with pagination and filtering
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('category').optional().isString().withMessage('Category must be a string'),
  query('active_only').optional().isBoolean().withMessage('Active only must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const activeOnly = req.query.active_only === 'true';
    const offset = (page - 1) * limit;

    let whereClause = '';
    let queryParams = [];
    let paramIndex = 1;

    if (activeOnly) {
      whereClause = 'WHERE s.is_active = $' + paramIndex;
      queryParams.push(true);
      paramIndex++;
    }

    if (search) {
      if (whereClause) {
        whereClause += ' AND ';
      } else {
        whereClause = 'WHERE ';
      }
      whereClause += `(s.name ILIKE $${paramIndex} OR s.description ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (category) {
      if (whereClause) {
        whereClause += ' AND ';
      } else {
        whereClause = 'WHERE ';
      }
      whereClause += `s.category = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM services s 
      ${whereClause}
    `;
    const countResult = await req.app.locals.db.query(countQuery, queryParams);
    const totalServices = parseInt(countResult.rows[0].total);

    // Get services
    const servicesQuery = `
      SELECT 
        s.id,
        s.name,
        s.description,
        s.category,
        s.unit,
        s.standard_rate,
        s.cost,
        s.notes,
        s.is_active,
        s.created_by,
        u.username as created_by_username,
        s.created_at,
        s.updated_at
      FROM services s
      LEFT JOIN users u ON s.created_by = u.id
      ${whereClause}
      ORDER BY s.name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    const result = await req.app.locals.db.query(servicesQuery, queryParams);

    const totalPages = Math.ceil(totalServices / limit);

    res.json({
      services: result.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalServices,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get service categories
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT category 
      FROM services 
      WHERE category IS NOT NULL AND category != '' 
      ORDER BY category ASC
    `;
    const result = await req.app.locals.db.query(query);
    const categories = result.rows.map(row => row.category);
    
    res.json({ categories });
  } catch (error) {
    console.error('Error fetching service categories:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single service
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    if (isNaN(serviceId)) {
      return res.status(400).json({ message: 'Invalid service ID' });
    }

    const query = `
      SELECT 
        s.id,
        s.name,
        s.description,
        s.category,
        s.unit,
        s.standard_rate,
        s.cost,
        s.notes,
        s.is_active,
        s.created_by,
        u.username as created_by_username,
        s.created_at,
        s.updated_at
      FROM services s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = $1
    `;
    
    const result = await req.app.locals.db.query(query, [serviceId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Service not found' });
    }

    res.json({ service: result.rows[0] });
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create new service (admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
  body('description').optional().trim(),
  body('category').optional().trim(),
  body('unit').trim().isLength({ min: 1 }).withMessage('Unit is required'),
  body('standard_rate').isFloat({ min: 0 }).withMessage('Standard rate must be a positive number'),
  body('cost').optional().isFloat({ min: 0 }).withMessage('Cost must be a positive number'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { name, description, category, unit, standard_rate, cost, notes } = req.body;

    const query = `
      INSERT INTO services (name, description, category, unit, standard_rate, cost, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, description, category, unit, standard_rate, cost, notes, is_active, created_by, created_at, updated_at
    `;
    
    const result = await req.app.locals.db.query(query, [
      name, 
      description || null, 
      category || null, 
      unit, 
      standard_rate, 
      cost || null, 
      notes || null, 
      req.user.id
    ]);

    res.status(201).json({
      message: 'Service created successfully',
      service: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating service:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ message: 'Service with this name already exists' });
    } else {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

// Update service (admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('name').optional().trim().isLength({ min: 1 }).withMessage('Name cannot be empty'),
  body('description').optional().trim(),
  body('category').optional().trim(),
  body('unit').optional().trim().isLength({ min: 1 }).withMessage('Unit cannot be empty'),
  body('standard_rate').optional().isFloat({ min: 0 }).withMessage('Standard rate must be a positive number'),
  body('cost').optional().isFloat({ min: 0 }).withMessage('Cost must be a positive number'),
  body('notes').optional().trim(),
  body('is_active').optional().isBoolean().withMessage('Is active must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const serviceId = parseInt(req.params.id);
    if (isNaN(serviceId)) {
      return res.status(400).json({ message: 'Invalid service ID' });
    }

    const { name, description, category, unit, standard_rate, cost, notes, is_active } = req.body;

    // Check if service exists
    const checkQuery = 'SELECT id FROM services WHERE id = $1';
    const checkResult = await req.app.locals.db.query(checkQuery, [serviceId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Build update query dynamically
    let updateFields = [];
    let queryParams = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      queryParams.push(name);
      paramIndex++;
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      queryParams.push(description || null);
      paramIndex++;
    }
    if (category !== undefined) {
      updateFields.push(`category = $${paramIndex}`);
      queryParams.push(category || null);
      paramIndex++;
    }
    if (unit !== undefined) {
      updateFields.push(`unit = $${paramIndex}`);
      queryParams.push(unit);
      paramIndex++;
    }
    if (standard_rate !== undefined) {
      updateFields.push(`standard_rate = $${paramIndex}`);
      queryParams.push(standard_rate);
      paramIndex++;
    }
    if (cost !== undefined) {
      updateFields.push(`cost = $${paramIndex}`);
      queryParams.push(cost || null);
      paramIndex++;
    }
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex}`);
      queryParams.push(notes || null);
      paramIndex++;
    }
    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramIndex}`);
      queryParams.push(is_active);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    // Add updated_at
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    queryParams.push(serviceId);

    const updateQuery = `
      UPDATE services 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, description, category, unit, standard_rate, cost, notes, is_active, created_by, created_at, updated_at
    `;

    const result = await req.app.locals.db.query(updateQuery, queryParams);

    res.json({
      message: 'Service updated successfully',
      service: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating service:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ message: 'Service with this name already exists' });
    } else {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
});

// Delete service (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    if (isNaN(serviceId)) {
      return res.status(400).json({ message: 'Invalid service ID' });
    }

    const query = 'DELETE FROM services WHERE id = $1 RETURNING id';
    const result = await req.app.locals.db.query(query, [serviceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Service not found' });
    }

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 