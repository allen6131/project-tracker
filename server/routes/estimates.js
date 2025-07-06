const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireActive } = require('../middleware/auth');
const EmailService = require('../services/emailService');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireActive);

// GET /api/estimates - Get all estimates
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';

    let query = `
      SELECT e.*, u.username as created_by_username, c.name as customer_name
      FROM estimates e
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN customers c ON e.customer_id = c.id
    `;
    let countQuery = 'SELECT COUNT(*) FROM estimates e';
    let queryParams = [];
    let countParams = [];
    let whereConditions = [];

    // Add search filter
    if (search) {
      whereConditions.push(`(e.title ILIKE $${queryParams.length + 1} OR e.description ILIKE $${queryParams.length + 1})`);
      queryParams.push(`%${search}%`);
      countParams.push(`%${search}%`);
    }

    // Add status filter
    if (status && ['draft', 'sent', 'approved', 'rejected', 'expired'].includes(status)) {
      whereConditions.push(`e.status = $${queryParams.length + 1}`);
      queryParams.push(status);
      countParams.push(status);
    }

    // Apply WHERE conditions
    if (whereConditions.length > 0) {
      const whereClause = ' WHERE ' + whereConditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY e.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const [estimatesResult, countResult] = await Promise.all([
      req.app.locals.db.query(query, queryParams),
      req.app.locals.db.query(countQuery, countParams)
    ]);

    const totalEstimates = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalEstimates / limit);

    // Convert decimal values to numbers for each estimate
    const estimates = estimatesResult.rows.map(estimate => ({
      ...estimate,
      subtotal: parseFloat(estimate.subtotal) || 0,
      tax_rate: parseFloat(estimate.tax_rate) || 0,
      tax_amount: parseFloat(estimate.tax_amount) || 0,
      total_amount: parseFloat(estimate.total_amount) || 0
    }));

    res.json({
      estimates,
      pagination: {
        currentPage: page,
        totalPages,
        totalEstimates,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get estimates error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/estimates - Create new estimate
router.post('/', [
  body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('customer_id')
    .optional()
    .isInt()
    .withMessage('Customer ID must be a valid integer'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.description')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Item description is required'),
  body('items.*.quantity')
    .isFloat({ min: 0.01 })
    .withMessage('Item quantity must be greater than 0'),
  body('items.*.unit_price')
    .isFloat({ min: 0 })
    .withMessage('Item unit price must be 0 or greater')
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
      title, 
      description = '', 
      customer_id, 
      customer_name = '',
      customer_email = '',
      customer_phone = '',
      customer_address = '',
      tax_rate = 0,
      valid_until,
      notes = '',
      items 
    } = req.body;

    // Validate customer exists if provided
    if (customer_id) {
      const customerCheck = await req.app.locals.db.query(
        'SELECT id, name, email, phone, address FROM customers WHERE id = $1',
        [customer_id]
      );
      if (customerCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid customer ID' });
      }
    }

    // Calculate totals
    let subtotal = 0;
    const processedItems = items.map(item => {
      const totalPrice = parseFloat(item.quantity) * parseFloat(item.unit_price);
      subtotal += totalPrice;
      return {
        ...item,
        total_price: totalPrice
      };
    });

    const taxAmount = subtotal * (parseFloat(tax_rate) / 100);
    const totalAmount = subtotal + taxAmount;

    // Create estimate
    const estimateResult = await req.app.locals.db.query(
      `INSERT INTO estimates (
        title, description, customer_id, customer_name, customer_email, 
        customer_phone, customer_address, subtotal, tax_rate, tax_amount, 
        total_amount, valid_until, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        title, description, customer_id || null, customer_name, customer_email,
        customer_phone, customer_address, subtotal, tax_rate, taxAmount,
        totalAmount, valid_until || null, notes, req.user.userId
      ]
    );

    const estimateId = estimateResult.rows[0].id;

    // Create estimate items
    for (const item of processedItems) {
      await req.app.locals.db.query(
        'INSERT INTO estimate_items (estimate_id, description, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5)',
        [estimateId, item.description, item.quantity, item.unit_price, item.total_price]
      );
    }

    // Get the created estimate with items
    const fullEstimate = await getEstimateWithItems(req.app.locals.db, estimateId);

    res.status(201).json({
      message: 'Estimate created successfully',
      estimate: fullEstimate
    });

  } catch (error) {
    console.error('Create estimate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/estimates/:id - Get specific estimate with items
router.get('/:id', async (req, res) => {
  try {
    const estimateId = parseInt(req.params.id);
    
    if (isNaN(estimateId)) {
      return res.status(400).json({ message: 'Invalid estimate ID' });
    }

    const estimate = await getEstimateWithItems(req.app.locals.db, estimateId);

    if (!estimate) {
      return res.status(404).json({ message: 'Estimate not found' });
    }

    res.json({ estimate });

  } catch (error) {
    console.error('Get estimate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/estimates/:id - Update estimate
router.put('/:id', [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  body('status')
    .optional()
    .isIn(['draft', 'sent', 'approved', 'rejected', 'expired'])
    .withMessage('Status must be one of: draft, sent, approved, rejected, expired')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const estimateId = parseInt(req.params.id);
    
    if (isNaN(estimateId)) {
      return res.status(400).json({ message: 'Invalid estimate ID' });
    }

    const updates = {};
    const allowedFields = [
      'title', 'description', 'status', 'customer_id', 'customer_name',
      'customer_email', 'customer_phone', 'customer_address', 'tax_rate',
      'valid_until', 'notes'
    ];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field] === '' ? null : req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Build dynamic query
    const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(estimateId);

    const query = `
      UPDATE estimates 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${values.length} 
      RETURNING *
    `;

    const result = await req.app.locals.db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Estimate not found' });
    }

    const fullEstimate = await getEstimateWithItems(req.app.locals.db, estimateId);

    res.json({
      message: 'Estimate updated successfully',
      estimate: fullEstimate
    });

  } catch (error) {
    console.error('Update estimate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/estimates/:id - Delete estimate
router.delete('/:id', async (req, res) => {
  try {
    const estimateId = parseInt(req.params.id);
    
    if (isNaN(estimateId)) {
      return res.status(400).json({ message: 'Invalid estimate ID' });
    }

    const result = await req.app.locals.db.query(
      'DELETE FROM estimates WHERE id = $1 RETURNING id, title',
      [estimateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Estimate not found' });
    }

    res.json({
      message: 'Estimate deleted successfully',
      deletedEstimate: result.rows[0]
    });

  } catch (error) {
    console.error('Delete estimate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/estimates/:id/send-email - Send estimate via email
router.post('/:id/send-email', [
  body('recipient_email')
    .isEmail()
    .withMessage('Valid recipient email is required'),
  body('sender_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Sender name must be between 1 and 100 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const estimateId = parseInt(req.params.id);
    const { recipient_email, sender_name } = req.body;
    
    if (isNaN(estimateId)) {
      return res.status(400).json({ message: 'Invalid estimate ID' });
    }

    // Get estimate with items
    const estimate = await getEstimateWithItems(req.app.locals.db, estimateId);

    if (!estimate) {
      return res.status(404).json({ message: 'Estimate not found' });
    }

    // Get sender name from user if not provided
    const finalSenderName = sender_name || req.user.username || 'AmpTrack';

    // Check if email service is available
    if (!EmailService.isAvailable()) {
      return res.status(503).json({ 
        message: 'Email service is currently unavailable. Please contact support.',
        email_available: false
      });
    }

    // Send email
    try {
      const emailResult = await EmailService.sendEstimateEmail(estimate, recipient_email, finalSenderName);
      
      if (!emailResult.success) {
        return res.status(500).json({ 
          message: 'Failed to send email. Email service not configured.',
          error: emailResult.error
        });
      }
      
      // Update estimate status to 'sent' if it was 'draft'
      if (estimate.status === 'draft') {
        await req.app.locals.db.query(
          'UPDATE estimates SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['sent', estimateId]
        );
      }

      res.json({
        message: 'Estimate sent successfully via email',
        recipient: recipient_email
      });

    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      res.status(500).json({ 
        message: 'Failed to send email. Please check your email configuration.',
        error: emailError.message 
      });
    }

  } catch (error) {
    console.error('Send estimate email error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/estimates/:id/create-project - Create project from estimate
router.post('/:id/create-project', [
  body('project_name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Project name must be between 1 and 200 characters'),
  body('project_description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Project description must not exceed 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const estimateId = parseInt(req.params.id);
    const { project_name, project_description = '' } = req.body;
    
    if (isNaN(estimateId)) {
      return res.status(400).json({ message: 'Invalid estimate ID' });
    }

    // Get estimate details
    const estimateResult = await req.app.locals.db.query(
      'SELECT * FROM estimates WHERE id = $1 AND status = $2',
      [estimateId, 'approved']
    );

    if (estimateResult.rows.length === 0) {
      return res.status(400).json({ message: 'Estimate not found or not approved' });
    }

    const estimate = estimateResult.rows[0];

    // Check if project name already exists
    const existingProject = await req.app.locals.db.query(
      'SELECT id FROM projects WHERE name = $1',
      [project_name]
    );

    if (existingProject.rows.length > 0) {
      return res.status(409).json({ message: 'Project name already exists' });
    }

    // Create project
    const projectResult = await req.app.locals.db.query(
      'INSERT INTO projects (name, description, customer_id, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [project_name, project_description, estimate.customer_id, req.user.userId]
    );

    const projectId = projectResult.rows[0].id;

    // Create default folders for the new project
    const defaultFolders = ['Bidding', 'Plans and Drawings', 'Plan Review', 'Field Markups'];
    for (const folderName of defaultFolders) {
      await req.app.locals.db.query(
        'INSERT INTO project_folders (project_id, name, is_default, created_by) VALUES ($1, $2, true, $3)',
        [projectId, folderName, req.user.userId]
      );
    }

    // Update estimate status to indicate project was created
    await req.app.locals.db.query(
      'UPDATE estimates SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['approved', estimateId]
    );

    res.status(201).json({
      message: 'Project created successfully from estimate',
      project: projectResult.rows[0],
      estimate_id: estimateId
    });

  } catch (error) {
    console.error('Create project from estimate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Helper function to get estimate with items
async function getEstimateWithItems(db, estimateId) {
  const estimateResult = await db.query(
    `SELECT e.*, u.username as created_by_username, c.name as customer_name
     FROM estimates e
     LEFT JOIN users u ON e.created_by = u.id
     LEFT JOIN customers c ON e.customer_id = c.id
     WHERE e.id = $1`,
    [estimateId]
  );

  if (estimateResult.rows.length === 0) {
    return null;
  }

  const estimate = estimateResult.rows[0];

  // Convert decimal values to numbers
  estimate.subtotal = parseFloat(estimate.subtotal) || 0;
  estimate.tax_rate = parseFloat(estimate.tax_rate) || 0;
  estimate.tax_amount = parseFloat(estimate.tax_amount) || 0;
  estimate.total_amount = parseFloat(estimate.total_amount) || 0;

  // Get estimate items
  const itemsResult = await db.query(
    'SELECT * FROM estimate_items WHERE estimate_id = $1 ORDER BY id',
    [estimateId]
  );

  // Convert item decimal values to numbers
  estimate.items = itemsResult.rows.map(item => ({
    ...item,
    quantity: parseFloat(item.quantity) || 0,
    unit_price: parseFloat(item.unit_price) || 0,
    total_price: parseFloat(item.total_price) || 0
  }));

  return estimate;
}

module.exports = router; 