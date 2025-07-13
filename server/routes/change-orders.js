const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireActive } = require('../middleware/auth');
const EmailService = require('../services/emailService');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireActive);

// GET /api/change-orders/project/:projectId - Get all change orders for a project
router.get('/project/:projectId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    
    if (isNaN(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const changeOrdersResult = await req.app.locals.db.query(
      `SELECT co.*, u.username as created_by_username, c.name as customer_name, p.name as project_name
       FROM change_orders co
       LEFT JOIN users u ON co.created_by = u.id
       LEFT JOIN customers c ON co.customer_id = c.id
       LEFT JOIN projects p ON co.project_id = p.id
       WHERE co.project_id = $1
       ORDER BY co.created_at DESC`,
      [projectId]
    );

    // Convert decimal values to numbers for each change order
    const changeOrders = changeOrdersResult.rows.map(changeOrder => ({
      ...changeOrder,
      subtotal: parseFloat(changeOrder.subtotal) || 0,
      tax_rate: parseFloat(changeOrder.tax_rate) || 0,
      tax_amount: parseFloat(changeOrder.tax_amount) || 0,
      total_amount: parseFloat(changeOrder.total_amount) || 0
    }));

    res.json({ changeOrders });

  } catch (error) {
    console.error('Get project change orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/change-orders - Create new change order
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
  body('project_id')
    .isInt()
    .withMessage('Project ID must be a valid integer'),
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
      project_id,
      customer_id,
      customer_name = '',
      customer_email = '',
      customer_phone = '',
      customer_address = '',
      reason = '',
      justification = '',
      tax_rate = 0,
      requested_date,
      notes = '',
      items 
    } = req.body;

    // Validate project exists
    const projectCheck = await req.app.locals.db.query(
      'SELECT id, name, customer_id FROM projects WHERE id = $1',
      [project_id]
    );
    
    if (projectCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    const project = projectCheck.rows[0];

    // Generate change order number
    const changeOrderNumber = await generateChangeOrderNumber(req.app.locals.db);

    // Get customer info from project if not provided
    let finalCustomerId = customer_id;
    let finalCustomerName = customer_name;
    let finalCustomerEmail = customer_email;
    let finalCustomerPhone = customer_phone;
    let finalCustomerAddress = customer_address;

    if (project.customer_id && !customer_id) {
      const customerResult = await req.app.locals.db.query(
        'SELECT id, name, email, phone, address FROM customers WHERE id = $1',
        [project.customer_id]
      );
      
      if (customerResult.rows.length > 0) {
        const customer = customerResult.rows[0];
        finalCustomerId = customer.id;
        finalCustomerName = customer.name;
        finalCustomerEmail = customer.email || '';
        finalCustomerPhone = customer.phone || '';
        finalCustomerAddress = customer.address || '';
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

    // Create change order
    const changeOrderResult = await req.app.locals.db.query(
      `INSERT INTO change_orders (
        change_order_number, title, description, project_id, customer_id, customer_name, 
        customer_email, customer_phone, customer_address, status, reason, justification, 
        subtotal, tax_rate, tax_amount, total_amount, requested_date, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
      [
        changeOrderNumber, title, description, project_id, finalCustomerId, finalCustomerName,
        finalCustomerEmail, finalCustomerPhone, finalCustomerAddress, 'draft', reason, justification,
        subtotal, tax_rate, taxAmount, totalAmount, requested_date || null, notes, req.user.userId
      ]
    );

    const changeOrderId = changeOrderResult.rows[0].id;

    // Create change order items
    for (const item of processedItems) {
      await req.app.locals.db.query(
        'INSERT INTO change_order_items (change_order_id, description, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5)',
        [changeOrderId, item.description, item.quantity, item.unit_price, item.total_price]
      );
    }

    // Get the created change order with items
    const fullChangeOrder = await getChangeOrderWithItems(req.app.locals.db, changeOrderId);

    res.status(201).json({
      message: 'Change order created successfully',
      changeOrder: fullChangeOrder
    });

  } catch (error) {
    console.error('Create change order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/change-orders/:id - Get specific change order with items
router.get('/:id', async (req, res) => {
  try {
    const changeOrderId = parseInt(req.params.id);
    
    if (isNaN(changeOrderId)) {
      return res.status(400).json({ message: 'Invalid change order ID' });
    }

    const changeOrder = await getChangeOrderWithItems(req.app.locals.db, changeOrderId);

    if (!changeOrder) {
      return res.status(404).json({ message: 'Change order not found' });
    }

    res.json({ changeOrder });

  } catch (error) {
    console.error('Get change order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/change-orders/:id - Update change order
router.put('/:id', [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  body('status')
    .optional()
    .isIn(['draft', 'sent', 'approved', 'rejected', 'cancelled'])
    .withMessage('Status must be one of: draft, sent, approved, rejected, cancelled')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const changeOrderId = parseInt(req.params.id);
    
    if (isNaN(changeOrderId)) {
      return res.status(400).json({ message: 'Invalid change order ID' });
    }

    const updates = {};
    const allowedFields = [
      'title', 'description', 'status', 'customer_name', 'customer_email', 
      'customer_phone', 'customer_address', 'reason', 'justification', 
      'tax_rate', 'requested_date', 'approved_date', 'notes'
    ];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field] === '' ? null : req.body[field];
      }
    });

    // Auto-set approved_date when status becomes 'approved'
    if (updates.status === 'approved' && !updates.approved_date) {
      updates.approved_date = new Date().toISOString().split('T')[0];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Build dynamic query
    const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(changeOrderId);

    const query = `
      UPDATE change_orders 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${values.length} 
      RETURNING *
    `;

    const result = await req.app.locals.db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Change order not found' });
    }

    const fullChangeOrder = await getChangeOrderWithItems(req.app.locals.db, changeOrderId);

    res.json({
      message: 'Change order updated successfully',
      changeOrder: fullChangeOrder
    });

  } catch (error) {
    console.error('Update change order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/change-orders/:id - Delete change order
router.delete('/:id', async (req, res) => {
  try {
    const changeOrderId = parseInt(req.params.id);
    
    if (isNaN(changeOrderId)) {
      return res.status(400).json({ message: 'Invalid change order ID' });
    }

    const result = await req.app.locals.db.query(
      'DELETE FROM change_orders WHERE id = $1 RETURNING id, title, change_order_number',
      [changeOrderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Change order not found' });
    }

    res.json({
      message: 'Change order deleted successfully',
      deletedChangeOrder: result.rows[0]
    });

  } catch (error) {
    console.error('Delete change order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/change-orders/:id/send-email - Send change order via email
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

    const changeOrderId = parseInt(req.params.id);
    const { recipient_email, sender_name } = req.body;
    
    if (isNaN(changeOrderId)) {
      return res.status(400).json({ message: 'Invalid change order ID' });
    }

    // Get change order with items
    const changeOrder = await getChangeOrderWithItems(req.app.locals.db, changeOrderId);

    if (!changeOrder) {
      return res.status(404).json({ message: 'Change order not found' });
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
      const emailResult = await EmailService.sendChangeOrderEmail(changeOrder, recipient_email, finalSenderName);
      
      if (!emailResult.success) {
        return res.status(500).json({ 
          message: 'Failed to send email. Email service not configured.',
          error: emailResult.error
        });
      }
      
      // Update change order status to 'sent' if it was 'draft'
      if (changeOrder.status === 'draft') {
        await req.app.locals.db.query(
          'UPDATE change_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['sent', changeOrderId]
        );
      }

      res.json({
        message: 'Change order sent successfully via email',
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
    console.error('Send change order email error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Helper function to generate change order number
async function generateChangeOrderNumber(db) {
  const year = new Date().getFullYear();
  const result = await db.query(
    'SELECT COUNT(*) as count FROM change_orders WHERE EXTRACT(YEAR FROM created_at) = $1',
    [year]
  );
  const count = parseInt(result.rows[0].count);
  return `CO-${year}-${String(count + 1).padStart(4, '0')}`;
}

// Helper function to get change order with items
async function getChangeOrderWithItems(db, changeOrderId) {
  const changeOrderResult = await db.query(
    `SELECT co.*, u.username as created_by_username, c.name as customer_name, p.name as project_name
     FROM change_orders co
     LEFT JOIN users u ON co.created_by = u.id
     LEFT JOIN customers c ON co.customer_id = c.id
     LEFT JOIN projects p ON co.project_id = p.id
     WHERE co.id = $1`,
    [changeOrderId]
  );

  if (changeOrderResult.rows.length === 0) {
    return null;
  }

  const changeOrder = changeOrderResult.rows[0];

  // Convert decimal values to numbers
  changeOrder.subtotal = parseFloat(changeOrder.subtotal) || 0;
  changeOrder.tax_rate = parseFloat(changeOrder.tax_rate) || 0;
  changeOrder.tax_amount = parseFloat(changeOrder.tax_amount) || 0;
  changeOrder.total_amount = parseFloat(changeOrder.total_amount) || 0;

  // Get change order items
  const itemsResult = await db.query(
    'SELECT * FROM change_order_items WHERE change_order_id = $1 ORDER BY id',
    [changeOrderId]
  );

  // Convert item decimal values to numbers
  changeOrder.items = itemsResult.rows.map(item => ({
    ...item,
    quantity: parseFloat(item.quantity) || 0,
    unit_price: parseFloat(item.unit_price) || 0,
    total_price: parseFloat(item.total_price) || 0
  }));

  return changeOrder;
}

module.exports = router; 