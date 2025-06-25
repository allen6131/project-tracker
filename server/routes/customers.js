const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireActive } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireActive);

// CUSTOMERS ROUTES

// GET /api/customers - Get all customers
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let query = `
      SELECT c.*, u.username as created_by_username
      FROM customers c
      LEFT JOIN users u ON c.created_by = u.id
    `;
    let countQuery = 'SELECT COUNT(*) FROM customers c';
    let queryParams = [];
    let countParams = [];

    if (search) {
      query += ' WHERE c.name ILIKE $1 OR c.industry ILIKE $1 OR c.email ILIKE $1';
      countQuery += ' WHERE c.name ILIKE $1 OR c.industry ILIKE $1 OR c.email ILIKE $1';
      queryParams.push(`%${search}%`);
      countParams.push(`%${search}%`);
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const [customersResult, countResult] = await Promise.all([
      req.app.locals.db.query(query, queryParams),
      req.app.locals.db.query(countQuery, countParams)
    ]);

    const totalCustomers = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCustomers / limit);

    res.json({
      customers: customersResult.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalCustomers,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/customers/simple - Get all customers for dropdowns
router.get('/simple', async (req, res) => {
  try {
    const result = await req.app.locals.db.query(
      'SELECT id, name FROM customers ORDER BY name ASC'
    );

    res.json({ customers: result.rows });
  } catch (error) {
    console.error('Get simple customers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/customers - Create new customer
router.post('/', [
  body('name').trim().notEmpty().withMessage('Company name is required').isLength({ max: 255 }).withMessage('Name must be 255 characters or less'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must be 1000 characters or less'),
  body('industry').optional().isLength({ max: 100 }).withMessage('Industry must be 100 characters or less'),
  body('website').optional().isURL().withMessage('Website must be a valid URL'),
  body('phone').optional().isLength({ max: 50 }).withMessage('Phone must be 50 characters or less'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('address').optional().isLength({ max: 500 }).withMessage('Address must be 500 characters or less'),
  body('city').optional().isLength({ max: 100 }).withMessage('City must be 100 characters or less'),
  body('state').optional().isLength({ max: 100 }).withMessage('State must be 100 characters or less'),
  body('country').optional().isLength({ max: 100 }).withMessage('Country must be 100 characters or less'),
  body('postal_code').optional().isLength({ max: 20 }).withMessage('Postal code must be 20 characters or less')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, description, industry, website, phone, email, address, city, state, country, postal_code } = req.body;

    const result = await req.app.locals.db.query(
      `INSERT INTO customers 
        (name, description, industry, website, phone, email, address, city, state, country, postal_code, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING *`,
      [name, description || null, industry || null, website || null, phone || null, email || null, 
       address || null, city || null, state || null, country || null, postal_code || null, req.user.userId]
    );

    res.status(201).json({
      message: 'Customer created successfully',
      customer: result.rows[0]
    });

  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/customers/:id - Get specific customer with contacts
router.get('/:id', async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    
    if (isNaN(customerId)) {
      return res.status(400).json({ message: 'Invalid customer ID' });
    }

    // Get customer details
    const customerResult = await req.app.locals.db.query(
      'SELECT c.*, u.username as created_by_username FROM customers c LEFT JOIN users u ON c.created_by = u.id WHERE c.id = $1',
      [customerId]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Get customer contacts
    const contactsResult = await req.app.locals.db.query(
      'SELECT * FROM contacts WHERE customer_id = $1 ORDER BY is_primary DESC, last_name ASC',
      [customerId]
    );

    const customer = customerResult.rows[0];
    customer.contacts = contactsResult.rows;

    res.json({ customer });

  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/customers/:id - Update customer
router.put('/:id', [
  body('name').trim().notEmpty().withMessage('Company name is required').isLength({ max: 255 }).withMessage('Name must be 255 characters or less'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must be 1000 characters or less'),
  body('industry').optional().isLength({ max: 100 }).withMessage('Industry must be 100 characters or less'),
  body('website').optional().isURL().withMessage('Website must be a valid URL'),
  body('phone').optional().isLength({ max: 50 }).withMessage('Phone must be 50 characters or less'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('address').optional().isLength({ max: 500 }).withMessage('Address must be 500 characters or less'),
  body('city').optional().isLength({ max: 100 }).withMessage('City must be 100 characters or less'),
  body('state').optional().isLength({ max: 100 }).withMessage('State must be 100 characters or less'),
  body('country').optional().isLength({ max: 100 }).withMessage('Country must be 100 characters or less'),
  body('postal_code').optional().isLength({ max: 20 }).withMessage('Postal code must be 20 characters or less')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const customerId = parseInt(req.params.id);
    
    if (isNaN(customerId)) {
      return res.status(400).json({ message: 'Invalid customer ID' });
    }

    const { name, description, industry, website, phone, email, address, city, state, country, postal_code } = req.body;

    const result = await req.app.locals.db.query(
      `UPDATE customers 
       SET name = $1, description = $2, industry = $3, website = $4, phone = $5, email = $6, 
           address = $7, city = $8, state = $9, country = $10, postal_code = $11, updated_at = CURRENT_TIMESTAMP
       WHERE id = $12 
       RETURNING *`,
      [name, description || null, industry || null, website || null, phone || null, email || null,
       address || null, city || null, state || null, country || null, postal_code || null, customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({
      message: 'Customer updated successfully',
      customer: result.rows[0]
    });

  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/customers/:id - Delete customer
router.delete('/:id', async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    
    if (isNaN(customerId)) {
      return res.status(400).json({ message: 'Invalid customer ID' });
    }

    const result = await req.app.locals.db.query(
      'DELETE FROM customers WHERE id = $1 RETURNING id, name',
      [customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({
      message: 'Customer deleted successfully',
      deletedCustomer: result.rows[0]
    });

  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// CONTACTS ROUTES

// POST /api/customers/:customerId/contacts - Create new contact
router.post('/:customerId/contacts', [
  body('first_name').trim().notEmpty().withMessage('First name is required').isLength({ max: 100 }).withMessage('First name must be 100 characters or less'),
  body('last_name').trim().notEmpty().withMessage('Last name is required').isLength({ max: 100 }).withMessage('Last name must be 100 characters or less'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('phone').optional().isLength({ max: 50 }).withMessage('Phone must be 50 characters or less'),
  body('position').optional().isLength({ max: 100 }).withMessage('Position must be 100 characters or less'),
  body('department').optional().isLength({ max: 100 }).withMessage('Department must be 100 characters or less'),
  body('is_primary').optional().isBoolean().withMessage('is_primary must be a boolean'),
  body('notes').optional().isLength({ max: 1000 }).withMessage('Notes must be 1000 characters or less')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const customerId = parseInt(req.params.customerId);
    
    if (isNaN(customerId)) {
      return res.status(400).json({ message: 'Invalid customer ID' });
    }

    const { first_name, last_name, email, phone, position, department, is_primary, notes } = req.body;

    // If this is being set as primary, unset other primary contacts
    if (is_primary) {
      await req.app.locals.db.query(
        'UPDATE contacts SET is_primary = false WHERE customer_id = $1',
        [customerId]
      );
    }

    const result = await req.app.locals.db.query(
      `INSERT INTO contacts 
        (customer_id, first_name, last_name, email, phone, position, department, is_primary, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [customerId, first_name, last_name, email || null, phone || null, position || null, 
       department || null, is_primary || false, notes || null]
    );

    res.status(201).json({
      message: 'Contact created successfully',
      contact: result.rows[0]
    });

  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/customers/:customerId/contacts/:contactId - Update contact
router.put('/:customerId/contacts/:contactId', [
  body('first_name').trim().notEmpty().withMessage('First name is required').isLength({ max: 100 }).withMessage('First name must be 100 characters or less'),
  body('last_name').trim().notEmpty().withMessage('Last name is required').isLength({ max: 100 }).withMessage('Last name must be 100 characters or less'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('phone').optional().isLength({ max: 50 }).withMessage('Phone must be 50 characters or less'),
  body('position').optional().isLength({ max: 100 }).withMessage('Position must be 100 characters or less'),
  body('department').optional().isLength({ max: 100 }).withMessage('Department must be 100 characters or less'),
  body('is_primary').optional().isBoolean().withMessage('is_primary must be a boolean'),
  body('notes').optional().isLength({ max: 1000 }).withMessage('Notes must be 1000 characters or less')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const customerId = parseInt(req.params.customerId);
    const contactId = parseInt(req.params.contactId);
    
    if (isNaN(customerId) || isNaN(contactId)) {
      return res.status(400).json({ message: 'Invalid customer or contact ID' });
    }

    const { first_name, last_name, email, phone, position, department, is_primary, notes } = req.body;

    // If this is being set as primary, unset other primary contacts
    if (is_primary) {
      await req.app.locals.db.query(
        'UPDATE contacts SET is_primary = false WHERE customer_id = $1 AND id != $2',
        [customerId, contactId]
      );
    }

    const result = await req.app.locals.db.query(
      `UPDATE contacts 
       SET first_name = $1, last_name = $2, email = $3, phone = $4, position = $5, 
           department = $6, is_primary = $7, notes = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND customer_id = $10
       RETURNING *`,
      [first_name, last_name, email || null, phone || null, position || null, 
       department || null, is_primary || false, notes || null, contactId, customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json({
      message: 'Contact updated successfully',
      contact: result.rows[0]
    });

  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/customers/:customerId/contacts/:contactId - Delete contact
router.delete('/:customerId/contacts/:contactId', async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);
    const contactId = parseInt(req.params.contactId);
    
    if (isNaN(customerId) || isNaN(contactId)) {
      return res.status(400).json({ message: 'Invalid customer or contact ID' });
    }

    const result = await req.app.locals.db.query(
      'DELETE FROM contacts WHERE id = $1 AND customer_id = $2 RETURNING id, first_name, last_name',
      [contactId, customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json({
      message: 'Contact deleted successfully',
      deletedContact: result.rows[0]
    });

  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 