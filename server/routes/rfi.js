const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const EmailService = require('../services/emailService');
const router = express.Router();

// POST /api/rfi/send - Send RFI email to customer contact
router.post('/send', [
  authenticateToken,
  body('project_id').isInt().withMessage('Project ID must be an integer'),
  body('customer_id').isInt().withMessage('Customer ID must be an integer'),
  body('contact_id').isInt().withMessage('Contact ID must be an integer'),
  body('subject').trim().notEmpty().withMessage('Subject is required').isLength({ max: 200 }).withMessage('Subject must be 200 characters or less'),
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 5000 }).withMessage('Message must be 5000 characters or less'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('response_needed_by').optional().isISO8601().withMessage('Response needed by must be a valid date'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation errors', errors: errors.array() });
    }

    const { project_id, customer_id, contact_id, subject, message, priority = 'medium', response_needed_by } = req.body;

    // Verify project exists and user has access
    const projectResult = await req.app.locals.db.query(
      'SELECT p.*, c.name as customer_name FROM projects p LEFT JOIN customers c ON p.customer_id = c.id WHERE p.id = $1',
      [project_id]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const project = projectResult.rows[0];

    // Verify customer exists and is associated with the project
    const customerResult = await req.app.locals.db.query(
      'SELECT * FROM customers WHERE id = $1',
      [customer_id]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const customer = customerResult.rows[0];

    // Verify contact exists and belongs to the customer
    const contactResult = await req.app.locals.db.query(
      'SELECT * FROM contacts WHERE id = $1 AND customer_id = $2',
      [contact_id, customer_id]
    );

    if (contactResult.rows.length === 0) {
      return res.status(404).json({ message: 'Contact not found or does not belong to this customer' });
    }

    const contact = contactResult.rows[0];

    if (!contact.email) {
      return res.status(400).json({ message: 'Contact does not have an email address' });
    }

    // Get sender information
    const senderResult = await req.app.locals.db.query(
      'SELECT username, email FROM users WHERE id = $1',
      [req.user.userId]
    );

    const sender = senderResult.rows[0];

    // Create RFI record in database
    const rfiResult = await req.app.locals.db.query(
      `INSERT INTO rfis (project_id, customer_id, contact_id, sent_by, subject, message, priority, response_needed_by, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sent', NOW(), NOW())
       RETURNING *`,
      [project_id, customer_id, contact_id, req.user.userId, subject, message, priority, response_needed_by]
    );

    const rfi = rfiResult.rows[0];

    // Send email
    try {
      await EmailService.sendRFIEmail({
        project,
        customer,
        contact,
        sender,
        rfi: {
          id: rfi.id,
          subject,
          message,
          priority,
          response_needed_by,
          created_at: rfi.created_at
        }
      });

      // Update RFI status to sent
      await req.app.locals.db.query(
        'UPDATE rfis SET status = $1, sent_at = NOW() WHERE id = $2',
        ['sent', rfi.id]
      );

      res.json({ 
        message: 'RFI email sent successfully',
        rfi_id: rfi.id
      });

    } catch (emailError) {
      console.error('Failed to send RFI email:', emailError);
      
      // Update RFI status to failed
      await req.app.locals.db.query(
        'UPDATE rfis SET status = $1, error_message = $2 WHERE id = $3',
        ['failed', emailError.message, rfi.id]
      );

      res.status(500).json({ message: 'Failed to send RFI email: ' + emailError.message });
    }

  } catch (error) {
    console.error('Send RFI error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rfi/project/:projectId - Get RFI history for a project
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    
    if (isNaN(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    // Verify project exists and user has access
    const projectResult = await req.app.locals.db.query(
      'SELECT id FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Get RFI history with customer and contact info
    const rfisResult = await req.app.locals.db.query(
      `SELECT 
        r.*,
        c.name as customer_name,
        co.first_name,
        co.last_name,
        co.email as contact_email,
        u.username as sent_by_username
      FROM rfis r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN contacts co ON r.contact_id = co.id
      LEFT JOIN users u ON r.sent_by = u.id
      WHERE r.project_id = $1
      ORDER BY r.created_at DESC`,
      [projectId]
    );

    res.json({ rfis: rfisResult.rows });

  } catch (error) {
    console.error('Get RFI history error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 