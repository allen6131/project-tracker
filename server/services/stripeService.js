const Stripe = require('stripe');

// Try to load config.js, fall back to config.example.js
let config;
try {
  config = require('../config.js');
} catch (error) {
  console.log('config.js not found, using example config');
  config = require('../config.example.js');
}

// Initialize Stripe with proper error handling
let stripe;
try {
  const stripeSecretKey = config.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey || stripeSecretKey.includes('your_stripe_secret_key')) {
    console.warn('Stripe secret key not configured - payment features will be disabled');
    stripe = null;
  } else {
    stripe = Stripe(stripeSecretKey);
  }
} catch (error) {
  console.error('Failed to initialize Stripe:', error);
  stripe = null;
}

const stripeService = {
  // Check if Stripe is available
  isAvailable() {
    return stripe !== null;
  },

  // Create a payment intent for an invoice
  async createPaymentIntent(invoiceId, amount, currency = 'usd', metadata = {}) {
    if (!this.isAvailable()) {
      throw new Error('Stripe is not configured');
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects amount in cents
        currency,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          invoice_id: invoiceId.toString(),
          ...metadata
        }
      });

      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  },

  // Create a checkout session for an invoice
  async createCheckoutSession(invoiceId, amount, invoiceNumber, successUrl, cancelUrl, customerEmail = null) {
    if (!this.isAvailable()) {
      throw new Error('Stripe is not configured');
    }

    try {
      const sessionData = {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Invoice ${invoiceNumber}`,
              },
              unit_amount: Math.round(amount * 100), // Stripe expects amount in cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          invoice_id: invoiceId.toString(),
          invoice_number: invoiceNumber
        }
      };

      // Add customer email if provided
      if (customerEmail) {
        sessionData.customer_email = customerEmail;
      }

      const session = await stripe.checkout.sessions.create(sessionData);
      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  },

  // Retrieve a payment intent
  async retrievePaymentIntent(paymentIntentId) {
    if (!this.isAvailable()) {
      throw new Error('Stripe is not configured');
    }

    try {
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      console.error('Error retrieving payment intent:', error);
      throw error;
    }
  },

  // Retrieve a checkout session
  async retrieveCheckoutSession(sessionId) {
    if (!this.isAvailable()) {
      throw new Error('Stripe is not configured');
    }

    try {
      return await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      console.error('Error retrieving checkout session:', error);
      throw error;
    }
  },

  // Confirm a payment intent
  async confirmPaymentIntent(paymentIntentId, paymentMethodId) {
    if (!this.isAvailable()) {
      throw new Error('Stripe is not configured');
    }

    try {
      return await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
      });
    } catch (error) {
      console.error('Error confirming payment intent:', error);
      throw error;
    }
  },

  // Handle webhook events
  constructEvent(body, signature, endpointSecret) {
    if (!this.isAvailable()) {
      throw new Error('Stripe is not configured');
    }

    try {
      return stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (error) {
      console.error('Error constructing webhook event:', error);
      throw error;
    }
  },

  // Process webhook events
  async processWebhookEvent(event) {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          return await this.handlePaymentIntentSucceeded(event.data.object);
        case 'checkout.session.completed':
          return await this.handleCheckoutSessionCompleted(event.data.object);
        case 'payment_intent.payment_failed':
          return await this.handlePaymentIntentFailed(event.data.object);
        default:
          console.log(`Unhandled event type: ${event.type}`);
          return null;
      }
    } catch (error) {
      console.error('Error processing webhook event:', error);
      throw error;
    }
  },

  // Handle successful payment intent
  async handlePaymentIntentSucceeded(paymentIntent) {
    console.log('Payment intent succeeded:', paymentIntent.id);
    return {
      type: 'payment_intent.succeeded',
      invoice_id: paymentIntent.metadata.invoice_id,
      payment_intent_id: paymentIntent.id,
      amount_received: paymentIntent.amount_received / 100
    };
  },

  // Handle completed checkout session
  async handleCheckoutSessionCompleted(session) {
    console.log('Checkout session completed:', session.id);
    return {
      type: 'checkout.session.completed',
      invoice_id: session.metadata.invoice_id,
      session_id: session.id,
      payment_intent_id: session.payment_intent,
      amount_total: session.amount_total / 100
    };
  },

  // Handle failed payment intent
  async handlePaymentIntentFailed(paymentIntent) {
    console.log('Payment intent failed:', paymentIntent.id);
    return {
      type: 'payment_intent.payment_failed',
      invoice_id: paymentIntent.metadata.invoice_id,
      payment_intent_id: paymentIntent.id,
      last_payment_error: paymentIntent.last_payment_error
    };
  }
};

module.exports = stripeService; 