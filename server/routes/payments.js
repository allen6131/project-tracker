const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireActive } = require('../middleware/auth');
const stripeService = require('../services/stripeService');

const router = express.Router();

// Apply authentication to payment routes (except webhooks)
router.use('/webhook', express.raw({ type: 'application/json' }));

// POST /api/payments/create-payment-intent
router.post('/create-payment-intent', [
  authenticateToken,
  requireActive,
  body('invoice_id').isInt().withMessage('Invoice ID must be a valid integer'),
], async (req, res) => {
  try {
    // Check if Stripe is configured
    if (!stripeService.isAvailable()) {
      return res.status(503).json({ 
        message: 'Payment processing is currently unavailable. Please contact support.' 
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { invoice_id } = req.body;

    // Get invoice details
    const invoiceResult = await req.app.locals.db.query(
      'SELECT * FROM invoices WHERE id = $1',
      [invoice_id]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];

    // Check if invoice is in a payable state
    if (invoice.status === 'paid') {
      return res.status(400).json({ message: 'Invoice is already paid' });
    }

    if (invoice.status === 'cancelled') {
      return res.status(400).json({ message: 'Invoice is cancelled' });
    }

    // Create payment intent
    const paymentIntent = await stripeService.createPaymentIntent(
      invoice_id,
      parseFloat(invoice.total_amount),
      'usd',
      {
        invoice_number: invoice.invoice_number,
        customer_email: invoice.customer_email || ''
      }
    );

    // Update invoice with payment intent ID
    await req.app.locals.db.query(
      'UPDATE invoices SET payment_intent_id = $1, payment_status = $2 WHERE id = $3',
      [paymentIntent.id, 'pending', invoice_id]
    );

    res.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id
    });

  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/payments/create-checkout-session
router.post('/create-checkout-session', [
  authenticateToken,
  requireActive,
  body('invoice_id').isInt().withMessage('Invoice ID must be a valid integer'),
  body('success_url').isURL().withMessage('Success URL must be a valid URL'),
  body('cancel_url').isURL().withMessage('Cancel URL must be a valid URL'),
], async (req, res) => {
  try {
    // Check if Stripe is configured
    if (!stripeService.isAvailable()) {
      return res.status(503).json({ 
        message: 'Payment processing is currently unavailable. Please contact support.' 
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { invoice_id, success_url, cancel_url } = req.body;

    // Get invoice details
    const invoiceResult = await req.app.locals.db.query(
      'SELECT * FROM invoices WHERE id = $1',
      [invoice_id]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];

    // Check if invoice is in a payable state
    if (invoice.status === 'paid') {
      return res.status(400).json({ message: 'Invoice is already paid' });
    }

    if (invoice.status === 'cancelled') {
      return res.status(400).json({ message: 'Invoice is cancelled' });
    }

    // Create checkout session
    const session = await stripeService.createCheckoutSession(
      invoice_id,
      parseFloat(invoice.total_amount),
      invoice.invoice_number,
      success_url,
      cancel_url,
      invoice.customer_email
    );

    // Update invoice with session ID
    await req.app.locals.db.query(
      'UPDATE invoices SET stripe_session_id = $1, payment_status = $2 WHERE id = $3',
      [session.id, 'pending', invoice_id]
    );

    res.json({
      session_id: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/payments/payment-status/:invoice_id
router.get('/payment-status/:invoice_id', [
  authenticateToken,
  requireActive,
], async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.invoice_id);

    if (isNaN(invoiceId)) {
      return res.status(400).json({ message: 'Invalid invoice ID' });
    }

    // Get invoice payment details
    const invoiceResult = await req.app.locals.db.query(
      'SELECT payment_intent_id, stripe_session_id, payment_status, payment_method, status FROM invoices WHERE id = $1',
      [invoiceId]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];
    let paymentDetails = null;

    // Get payment details from Stripe if available and configured
    if (invoice.payment_intent_id && stripeService.isAvailable()) {
      try {
        const paymentIntent = await stripeService.retrievePaymentIntent(invoice.payment_intent_id);
        paymentDetails = {
          status: paymentIntent.status,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          payment_method: paymentIntent.payment_method
        };
      } catch (error) {
        console.error('Error retrieving payment intent:', error);
      }
    }

    res.json({
      invoice_status: invoice.status,
      payment_status: invoice.payment_status,
      payment_method: invoice.payment_method,
      payment_details: paymentDetails,
      stripe_available: stripeService.isAvailable()
    });

  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/payments/webhook - Stripe webhook handler
router.post('/webhook', async (req, res) => {
  // Check if Stripe is configured
  if (!stripeService.isAvailable()) {
    console.error('Webhook received but Stripe is not configured');
    return res.status(400).json({ message: 'Payment processing not configured' });
  }

  const signature = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error('Stripe webhook secret not configured');
    return res.status(400).json({ message: 'Webhook secret not configured' });
  }

  try {
    // Construct the event from the webhook
    const event = stripeService.constructEvent(req.body, signature, endpointSecret);
    
    // Process the event
    const result = await stripeService.processWebhookEvent(event);

    if (result && result.invoice_id) {
      const invoiceId = parseInt(result.invoice_id);
      
      switch (result.type) {
        case 'payment_intent.succeeded':
        case 'checkout.session.completed':
          // Update invoice status to paid
          await req.app.locals.db.query(
            `UPDATE invoices SET 
             status = 'paid', 
             payment_status = 'succeeded', 
             payment_method = 'card',
             paid_date = CURRENT_DATE,
             updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [invoiceId]
          );
          console.log(`Invoice ${invoiceId} marked as paid`);
          break;

        case 'payment_intent.payment_failed':
          // Update invoice payment status to failed
          await req.app.locals.db.query(
            `UPDATE invoices SET 
             payment_status = 'failed',
             updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [invoiceId]
          );
          console.log(`Invoice ${invoiceId} payment failed`);
          break;
      }
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(400).json({ message: `Webhook error: ${error.message}` });
  }
});

// GET /api/payments/public-key
router.get('/public-key', (req, res) => {
  // Try to load config.js, fall back to config.example.js
  let config;
  try {
    config = require('../config.js');
  } catch (error) {
    config = require('../config.example.js');
  }

  const publishableKey = config.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY;
  
  if (!publishableKey || publishableKey.includes('your_stripe_publishable_key')) {
    return res.status(503).json({ 
      message: 'Payment processing is currently unavailable',
      stripe_available: false
    });
  }

  res.json({
    publishable_key: publishableKey,
    stripe_available: stripeService.isAvailable()
  });
});

module.exports = router; 