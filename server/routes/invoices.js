const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireActive } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireActive);

// GET /api/invoices - Get all invoices
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';

    let query = `
      SELECT i.*, u.username as created_by_username, c.name as customer_name,
             e.title as estimate_title, p.name as project_name
      FROM invoices i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN estimates e ON i.estimate_id = e.id
      LEFT JOIN projects p ON i.project_id = p.id
    `;
    let countQuery = 'SELECT COUNT(*) FROM invoices i';
    let queryParams = [];
    let countParams = [];
    let whereConditions = [];

    // Add search filter
    if (search) {
      whereConditions.push(`(i.title ILIKE $${queryParams.length + 1} OR i.invoice_number ILIKE $${queryParams.length + 1})`);
      queryParams.push(`%${search}%`);
      countParams.push(`%${search}%`);
    }

    // Add status filter
    if (status && ['draft', 'sent', 'paid', 'overdue', 'cancelled'].includes(status)) {
      whereConditions.push(`i.status = $${queryParams.length + 1}`);
      queryParams.push(status);
      countParams.push(status);
    }

    // Apply WHERE conditions
    if (whereConditions.length > 0) {
      const whereClause = ' WHERE ' + whereConditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const [invoicesResult, countResult] = await Promise.all([
      req.app.locals.db.query(query, queryParams),
      req.app.locals.db.query(countQuery, countParams)
    ]);

    const totalInvoices = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalInvoices / limit);

    // Convert decimal values to numbers for each invoice
    const invoices = invoicesResult.rows.map(invoice => ({
      ...invoice,
      subtotal: parseFloat(invoice.subtotal) || 0,
      tax_rate: parseFloat(invoice.tax_rate) || 0,
      tax_amount: parseFloat(invoice.tax_amount) || 0,
      total_amount: parseFloat(invoice.total_amount) || 0
    }));

    res.json({
      invoices,
      pagination: {
        currentPage: page,
        totalPages,
        totalInvoices,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/invoices - Create new invoice
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
  body('estimate_id')
    .optional()
    .isInt()
    .withMessage('Estimate ID must be a valid integer'),
  body('project_id')
    .optional()
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
      customer_id, 
      customer_name = '',
      customer_email = '',
      customer_phone = '',
      customer_address = '',
      estimate_id,
      project_id,
      tax_rate = 0,
      due_date,
      notes = '',
      items 
    } = req.body;

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(req.app.locals.db);

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

    // Validate estimate exists if provided
    if (estimate_id) {
      const estimateCheck = await req.app.locals.db.query(
        'SELECT id FROM estimates WHERE id = $1',
        [estimate_id]
      );
      if (estimateCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid estimate ID' });
      }
    }

    // Validate project exists if provided
    if (project_id) {
      const projectCheck = await req.app.locals.db.query(
        'SELECT id FROM projects WHERE id = $1',
        [project_id]
      );
      if (projectCheck.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid project ID' });
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

    // Create invoice
    const invoiceResult = await req.app.locals.db.query(
      `INSERT INTO invoices (
        invoice_number, title, description, customer_id, customer_name, customer_email, 
        customer_phone, customer_address, estimate_id, project_id, subtotal, tax_rate, 
        tax_amount, total_amount, due_date, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
      [
        invoiceNumber, title, description, customer_id || null, customer_name, customer_email,
        customer_phone, customer_address, estimate_id || null, project_id || null, subtotal, 
        tax_rate, taxAmount, totalAmount, due_date || null, notes, req.user.userId
      ]
    );

    const invoiceId = invoiceResult.rows[0].id;

    // Create invoice items
    for (const item of processedItems) {
      await req.app.locals.db.query(
        'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5)',
        [invoiceId, item.description, item.quantity, item.unit_price, item.total_price]
      );
    }

    // Get the created invoice with items
    const fullInvoice = await getInvoiceWithItems(req.app.locals.db, invoiceId);

    res.status(201).json({
      message: 'Invoice created successfully',
      invoice: fullInvoice
    });

  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/invoices/from-estimate/:estimateId - Create invoice from estimate
router.post('/from-estimate/:estimateId', [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  body('due_date')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Due date must be a valid date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const estimateId = parseInt(req.params.estimateId);
    const { title, due_date } = req.body;
    
    if (isNaN(estimateId)) {
      return res.status(400).json({ message: 'Invalid estimate ID' });
    }

    // Get estimate with items
    const estimate = await req.app.locals.db.query(
      `SELECT e.*, ei.description as item_description, ei.quantity, ei.unit_price, ei.total_price
       FROM estimates e
       LEFT JOIN estimate_items ei ON e.id = ei.estimate_id
       WHERE e.id = $1 AND e.status = 'approved'`,
      [estimateId]
    );

    if (estimate.rows.length === 0) {
      return res.status(400).json({ message: 'Estimate not found or not approved' });
    }

    const estimateData = estimate.rows[0];
    const invoiceNumber = await generateInvoiceNumber(req.app.locals.db);

    // Create invoice
    const invoiceResult = await req.app.locals.db.query(
      `INSERT INTO invoices (
        invoice_number, title, description, customer_id, customer_name, customer_email, 
        customer_phone, customer_address, estimate_id, subtotal, tax_rate, 
        tax_amount, total_amount, due_date, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [
        invoiceNumber, 
        title || estimateData.title, 
        estimateData.description, 
        estimateData.customer_id, 
        estimateData.customer_name, 
        estimateData.customer_email,
        estimateData.customer_phone, 
        estimateData.customer_address, 
        estimateId, 
        estimateData.subtotal, 
        estimateData.tax_rate, 
        estimateData.tax_amount, 
        estimateData.total_amount, 
        due_date || null, 
        estimateData.notes, 
        req.user.userId
      ]
    );

    const invoiceId = invoiceResult.rows[0].id;

    // Copy estimate items to invoice items
    const estimateItems = estimate.rows.filter(row => row.item_description);
    for (const item of estimateItems) {
      await req.app.locals.db.query(
        'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5)',
        [invoiceId, item.item_description, item.quantity, item.unit_price, item.total_price]
      );
    }

    const fullInvoice = await getInvoiceWithItems(req.app.locals.db, invoiceId);

    res.status(201).json({
      message: 'Invoice created successfully from estimate',
      invoice: fullInvoice
    });

  } catch (error) {
    console.error('Create invoice from estimate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/invoices/:id - Get specific invoice with items
router.get('/:id', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    
    if (isNaN(invoiceId)) {
      return res.status(400).json({ message: 'Invalid invoice ID' });
    }

    const invoice = await getInvoiceWithItems(req.app.locals.db, invoiceId);

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json({ invoice });

  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/invoices/:id - Update invoice
router.put('/:id', [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  body('status')
    .optional()
    .isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
    .withMessage('Status must be one of: draft, sent, paid, overdue, cancelled')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const invoiceId = parseInt(req.params.id);
    
    if (isNaN(invoiceId)) {
      return res.status(400).json({ message: 'Invalid invoice ID' });
    }

    const updates = {};
    const allowedFields = [
      'title', 'description', 'status', 'customer_id', 'customer_name',
      'customer_email', 'customer_phone', 'customer_address', 'tax_rate',
      'due_date', 'paid_date', 'notes'
    ];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field] === '' ? null : req.body[field];
      }
    });

    // Auto-set paid_date when status becomes 'paid'
    if (updates.status === 'paid' && !updates.paid_date) {
      updates.paid_date = new Date().toISOString().split('T')[0];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Build dynamic query
    const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(invoiceId);

    const query = `
      UPDATE invoices 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${values.length} 
      RETURNING *
    `;

    const result = await req.app.locals.db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const fullInvoice = await getInvoiceWithItems(req.app.locals.db, invoiceId);

    res.json({
      message: 'Invoice updated successfully',
      invoice: fullInvoice
    });

  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/invoices/:id - Delete invoice
router.delete('/:id', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    
    if (isNaN(invoiceId)) {
      return res.status(400).json({ message: 'Invalid invoice ID' });
    }

    const result = await req.app.locals.db.query(
      'DELETE FROM invoices WHERE id = $1 RETURNING id, title, invoice_number',
      [invoiceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json({
      message: 'Invoice deleted successfully',
      deletedInvoice: result.rows[0]
    });

  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Helper function to generate invoice number
async function generateInvoiceNumber(db) {
  const year = new Date().getFullYear();
  const result = await db.query(
    'SELECT COUNT(*) as count FROM invoices WHERE EXTRACT(YEAR FROM created_at) = $1',
    [year]
  );
  const count = parseInt(result.rows[0].count);
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
}

// Helper function to get invoice with items
async function getInvoiceWithItems(db, invoiceId) {
  const invoiceResult = await db.query(
    `SELECT i.*, u.username as created_by_username, c.name as customer_name,
            e.title as estimate_title, p.name as project_name
     FROM invoices i
     LEFT JOIN users u ON i.created_by = u.id
     LEFT JOIN customers c ON i.customer_id = c.id
     LEFT JOIN estimates e ON i.estimate_id = e.id
     LEFT JOIN projects p ON i.project_id = p.id
     WHERE i.id = $1`,
    [invoiceId]
  );

  if (invoiceResult.rows.length === 0) {
    return null;
  }

  const invoice = invoiceResult.rows[0];

  // Convert decimal values to numbers
  invoice.subtotal = parseFloat(invoice.subtotal) || 0;
  invoice.tax_rate = parseFloat(invoice.tax_rate) || 0;
  invoice.tax_amount = parseFloat(invoice.tax_amount) || 0;
  invoice.total_amount = parseFloat(invoice.total_amount) || 0;

  // Get invoice items
  const itemsResult = await db.query(
    'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id',
    [invoiceId]
  );

  // Convert item decimal values to numbers
  invoice.items = itemsResult.rows.map(item => ({
    ...item,
    quantity: parseFloat(item.quantity) || 0,
    unit_price: parseFloat(item.unit_price) || 0,
    total_price: parseFloat(item.total_price) || 0
  }));

  return invoice;
}

module.exports = router; 