const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireActive } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Multer storage configuration for receipt files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/receipts/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDF files are allowed for receipts'));
    }
  }
});

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireActive);

// GET /api/materials/project/:projectId - Get all materials for a project
router.get('/project/:projectId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const result = await req.app.locals.db.query(
      `SELECT m.*, u.username as created_by_username,
              COUNT(r.id) as receipt_count
       FROM project_materials m
       LEFT JOIN users u ON m.created_by = u.id
       LEFT JOIN material_receipts r ON m.id = r.material_id
       WHERE m.project_id = $1
       GROUP BY m.id, u.username
       ORDER BY m.created_at DESC`,
      [projectId]
    );

    res.json({ materials: result.rows });

  } catch (error) {
    console.error('Get project materials error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/materials - Create a new material entry
router.post('/', [
  body('project_id')
    .isInt()
    .withMessage('Project ID must be a valid integer'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Description must be between 1 and 500 characters'),
  body('quantity')
    .isFloat({ min: 0 })
    .withMessage('Quantity must be a positive number'),
  body('unit_cost')
    .isFloat({ min: 0 })
    .withMessage('Unit cost must be a positive number'),
  body('supplier')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Supplier must not exceed 255 characters'),
  body('purchase_date')
    .optional()
    .isISO8601()
    .withMessage('Purchase date must be a valid date'),
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
      project_id, 
      description, 
      quantity, 
      unit_cost, 
      supplier, 
      purchase_date, 
      notes 
    } = req.body;

    // Calculate total cost
    const total_cost = parseFloat(quantity) * parseFloat(unit_cost);

    const result = await req.app.locals.db.query(
      `INSERT INTO project_materials 
        (project_id, description, quantity, unit_cost, total_cost, supplier, purchase_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [project_id, description, quantity, unit_cost, total_cost, supplier || null, purchase_date || null, notes || null, req.user.userId]
    );

    res.status(201).json({
      message: 'Material entry created successfully',
      material: result.rows[0]
    });

  } catch (error) {
    console.error('Create material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/materials/:id - Update a material entry
router.put('/:id', [
  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Description must be between 1 and 500 characters'),
  body('quantity')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Quantity must be a positive number'),
  body('unit_cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Unit cost must be a positive number'),
  body('supplier')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Supplier must not exceed 255 characters'),
  body('purchase_date')
    .optional()
    .isISO8601()
    .withMessage('Purchase date must be a valid date'),
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

    const materialId = parseInt(req.params.id);
    if (isNaN(materialId)) {
      return res.status(400).json({ message: 'Invalid material ID' });
    }

    const updates = {};
    const allowedFields = ['description', 'quantity', 'unit_cost', 'supplier', 'purchase_date', 'notes'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field] === '' ? null : req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // If quantity or unit_cost is being updated, recalculate total_cost
    if (updates.quantity !== undefined || updates.unit_cost !== undefined) {
      // Get current values
      const currentMaterial = await req.app.locals.db.query(
        'SELECT quantity, unit_cost FROM project_materials WHERE id = $1',
        [materialId]
      );

      if (currentMaterial.rows.length === 0) {
        return res.status(404).json({ message: 'Material not found' });
      }

      const currentQuantity = updates.quantity !== undefined ? parseFloat(updates.quantity) : parseFloat(currentMaterial.rows[0].quantity);
      const currentUnitCost = updates.unit_cost !== undefined ? parseFloat(updates.unit_cost) : parseFloat(currentMaterial.rows[0].unit_cost);
      updates.total_cost = currentQuantity * currentUnitCost;
    }

    // Add updated_at timestamp
    updates.updated_at = 'CURRENT_TIMESTAMP';

    // Build dynamic query
    const setClause = Object.keys(updates).map((key, index) => {
      if (key === 'updated_at') {
        return `${key} = CURRENT_TIMESTAMP`;
      }
      return `${key} = $${index + 1}`;
    }).join(', ');
    
    const values = Object.values(updates).filter(value => value !== 'CURRENT_TIMESTAMP');
    values.push(materialId);

    const query = `
      UPDATE project_materials 
      SET ${setClause}
      WHERE id = $${values.length} 
      RETURNING *
    `;

    const result = await req.app.locals.db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Material not found' });
    }

    res.json({
      message: 'Material updated successfully',
      material: result.rows[0]
    });

  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/materials/:id - Delete a material entry
router.delete('/:id', async (req, res) => {
  try {
    const materialId = parseInt(req.params.id);

    if (isNaN(materialId)) {
      return res.status(400).json({ message: 'Invalid material ID' });
    }

    // Delete associated receipt files first
    const receipts = await req.app.locals.db.query(
      'SELECT file_path FROM material_receipts WHERE material_id = $1',
      [materialId]
    );

    // Delete receipt files from filesystem
    receipts.rows.forEach(receipt => {
      fs.unlink(path.resolve(receipt.file_path), (err) => {
        if (err) {
          console.error('Error deleting receipt file:', err);
        }
      });
    });

    // Delete the material entry (receipts will be deleted by CASCADE)
    const result = await req.app.locals.db.query(
      'DELETE FROM project_materials WHERE id = $1 RETURNING *',
      [materialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Material not found' });
    }

    res.json({
      message: 'Material deleted successfully',
      deletedMaterial: result.rows[0]
    });

  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/materials/:id/receipts - Upload receipt for a material
router.post('/:id/receipts', upload.single('receipt'), async (req, res) => {
  try {
    const materialId = parseInt(req.params.id);

    if (isNaN(materialId)) {
      return res.status(400).json({ message: 'Invalid material ID' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No receipt file provided' });
    }

    const { originalname, filename, path: filePath, mimetype, size } = req.file;

    // Verify material exists
    const materialCheck = await req.app.locals.db.query(
      'SELECT id FROM project_materials WHERE id = $1',
      [materialId]
    );

    if (materialCheck.rows.length === 0) {
      // Delete uploaded file since material doesn't exist
      fs.unlink(filePath, () => {});
      return res.status(404).json({ message: 'Material not found' });
    }

    const result = await req.app.locals.db.query(
      `INSERT INTO material_receipts 
        (material_id, original_name, stored_name, file_path, file_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [materialId, originalname, filename, filePath, mimetype, size, req.user.userId]
    );

    res.status(201).json({
      message: 'Receipt uploaded successfully',
      receipt: result.rows[0]
    });

  } catch (error) {
    console.error('Upload receipt error:', error);
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/materials/:id/receipts - Get all receipts for a material
router.get('/:id/receipts', async (req, res) => {
  try {
    const materialId = parseInt(req.params.id);

    if (isNaN(materialId)) {
      return res.status(400).json({ message: 'Invalid material ID' });
    }

    const result = await req.app.locals.db.query(
      `SELECT r.*, u.username as uploaded_by_username
       FROM material_receipts r
       LEFT JOIN users u ON r.uploaded_by = u.id
       WHERE r.material_id = $1
       ORDER BY r.created_at DESC`,
      [materialId]
    );

    res.json({ receipts: result.rows });

  } catch (error) {
    console.error('Get material receipts error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/materials/receipts/:receiptId/download - Download a receipt
router.get('/receipts/:receiptId/download', async (req, res) => {
  try {
    const receiptId = parseInt(req.params.receiptId);

    if (isNaN(receiptId)) {
      return res.status(400).json({ message: 'Invalid receipt ID' });
    }

    const result = await req.app.locals.db.query(
      'SELECT * FROM material_receipts WHERE id = $1',
      [receiptId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Receipt not found' });
    }

    const receipt = result.rows[0];
    const filePath = path.resolve(receipt.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Receipt file not found on server' });
    }

    res.download(filePath, receipt.original_name);

  } catch (error) {
    console.error('Download receipt error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/materials/receipts/:receiptId - Delete a receipt
router.delete('/receipts/:receiptId', async (req, res) => {
  try {
    const receiptId = parseInt(req.params.receiptId);

    if (isNaN(receiptId)) {
      return res.status(400).json({ message: 'Invalid receipt ID' });
    }

    const receiptResult = await req.app.locals.db.query(
      'SELECT * FROM material_receipts WHERE id = $1',
      [receiptId]
    );

    if (receiptResult.rows.length === 0) {
      return res.status(404).json({ message: 'Receipt not found' });
    }

    const receipt = receiptResult.rows[0];

    // Delete from database
    await req.app.locals.db.query(
      'DELETE FROM material_receipts WHERE id = $1',
      [receiptId]
    );

    // Delete file from filesystem
    fs.unlink(path.resolve(receipt.file_path), (err) => {
      if (err) {
        console.error('Error deleting receipt file:', err);
      }
    });

    res.json({
      message: 'Receipt deleted successfully',
      deletedReceipt: receipt
    });

  } catch (error) {
    console.error('Delete receipt error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 