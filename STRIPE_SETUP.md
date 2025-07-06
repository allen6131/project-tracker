# Stripe Payment Integration Setup Guide

This guide will help you set up Stripe payment processing for invoice payments in your project tracker application.

## Features Added

✅ **Credit Card Payment Processing** - Customers can pay invoices using credit cards
✅ **Stripe Checkout Integration** - Hosted checkout page for secure payments  
✅ **Payment Intent API** - Custom card forms with Stripe Elements
✅ **Webhook Support** - Automatic invoice status updates when payments succeed
✅ **Payment Status Tracking** - Track payment history and status
✅ **Beautiful Payment UI** - Modern, responsive payment forms
✅ **Success/Cancel Pages** - Proper redirect handling after payments

## 1. Stripe Account Setup

### 1.1 Create Stripe Account
1. Go to [https://stripe.com](https://stripe.com) and create an account
2. Complete your account verification
3. Navigate to the Dashboard

### 1.2 Get API Keys
1. In your Stripe Dashboard, go to **Developers > API keys**
2. Copy your **Publishable key** (starts with `pk_test_` for test mode)
3. Copy your **Secret key** (starts with `sk_test_` for test mode)

### 1.3 Set Up Webhook (Optional but Recommended)
1. Go to **Developers > Webhooks** in your Stripe Dashboard
2. Click **Add endpoint**
3. Enter your webhook URL: `https://your-domain.com/api/payments/webhook`
4. Select these events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the **Webhook signing secret** (starts with `whsec_`)

## 2. Environment Configuration

### 2.1 Server Configuration
Add these environment variables to your server's `.env` file or hosting platform:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 2.2 Update Server Config
The `server/config.example.js` file already includes Stripe configuration. If you have a custom `config.js` file, add:

```javascript
// Stripe Configuration for Payment Processing
STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_your_stripe_secret_key_here',
STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_your_stripe_publishable_key_here',
STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_your_webhook_secret_here',
```

## 3. Database Setup

The payment fields have been added to your database schema. Run the database update:

```bash
cd server
npm run update-db
```

This adds these fields to the `invoices` table:
- `payment_intent_id` - Stripe payment intent ID
- `payment_method` - Payment method used (card, etc.)
- `payment_status` - Payment status (pending, succeeded, failed)
- `stripe_session_id` - Stripe checkout session ID

## 4. Testing Payments

### 4.1 Test Credit Cards
Use these test card numbers in Stripe test mode:

**Successful Payments:**
- `4242424242424242` - Visa
- `4000056655665556` - Visa (debit)
- `5555555555554444` - Mastercard
- `378282246310005` - American Express

**Failed Payments:**
- `4000000000000002` - Card declined
- `4000000000009995` - Insufficient funds

Use any future expiry date, any 3-digit CVC, and any 5-digit ZIP code.

### 4.2 Testing Workflow
1. Create an invoice in your application
2. Set the invoice status to "Sent"
3. Click the "💳 Pay Invoice" button
4. Choose payment method:
   - **Stripe Checkout**: Redirects to Stripe's hosted page
   - **Credit Card**: Uses embedded card form
5. Enter test card details
6. Complete payment
7. Verify invoice status updates to "Paid"

## 5. Going Live

### 5.1 Activate Your Stripe Account
1. Complete all required business information in your Stripe Dashboard
2. Activate your account for live payments

### 5.2 Switch to Live Keys
1. In Stripe Dashboard, toggle from "Test data" to "Live data"
2. Copy your live API keys (they start with `pk_live_` and `sk_live_`)
3. Update your production environment variables:
   ```bash
   STRIPE_SECRET_KEY=sk_live_your_live_secret_key
   STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
   ```

### 5.3 Update Webhook for Production
1. Create a new webhook endpoint for your production URL
2. Use the same events as testing
3. Update `STRIPE_WEBHOOK_SECRET` with the live webhook secret

## 6. Usage Instructions

### 6.1 For Administrators
1. Create invoices as usual through the Invoices page
2. Set invoice status to "Sent" when ready for payment
3. Share invoice details with customers
4. Monitor payment status in the invoices list

### 6.2 For Customers
1. When an invoice is marked as "Sent", the "💳 Pay Invoice" button appears
2. Click the button to open the payment form
3. Choose between:
   - **Stripe Checkout** (recommended): Secure hosted payment page
   - **Credit Card**: Embedded payment form
4. Enter payment details and complete transaction
5. Receive confirmation on success page

## 7. Features Overview

### 7.1 Payment Methods Supported
- ✅ Credit Cards (Visa, Mastercard, American Express, etc.)
- ✅ Debit Cards
- ✅ International Cards (based on your Stripe account settings)

### 7.2 Security Features
- 🔒 PCI DSS compliant through Stripe
- 🔒 SSL/TLS encryption
- 🔒 3D Secure authentication support
- 🔒 Fraud detection and prevention
- 🔒 No sensitive card data stored on your servers

### 7.3 Automatic Features
- ✅ Invoice status automatically updates to "Paid" on successful payment
- ✅ Payment date is recorded automatically
- ✅ Payment method is tracked
- ✅ Email confirmations (if configured in Stripe Dashboard)

## 8. Troubleshooting

### 8.1 Common Issues

**"Payment system failed to initialize"**
- Check that `STRIPE_PUBLISHABLE_KEY` is set correctly
- Verify the key starts with `pk_test_` or `pk_live_`

**"Webhook secret not configured"**
- Set `STRIPE_WEBHOOK_SECRET` environment variable
- Ensure webhook endpoint is configured in Stripe Dashboard

**Payments succeed but invoice status doesn't update**
- Check webhook configuration
- Verify webhook secret matches
- Check server logs for webhook errors

**Payment form doesn't load**
- Check browser console for JavaScript errors
- Verify Stripe Elements are loading correctly
- Ensure network connectivity to Stripe

### 8.2 Debug Tips
1. Check browser Network tab for failed API requests
2. Review server logs for payment processing errors  
3. Use Stripe Dashboard logs to debug webhook issues
4. Test with different browsers and devices

## 9. Support

- **Stripe Documentation**: [https://stripe.com/docs](https://stripe.com/docs)
- **Stripe Support**: Available through your Stripe Dashboard
- **Test Cards**: [https://stripe.com/docs/testing](https://stripe.com/docs/testing)

## 10. Security Best Practices

1. **Never log sensitive payment data**
2. **Use HTTPS in production**
3. **Keep Stripe keys secure** - never expose secret keys in client-side code
4. **Regularly update dependencies**
5. **Monitor payment activities** through Stripe Dashboard
6. **Set up proper webhook endpoint security**

---

Your Stripe payment integration is now ready! Customers can securely pay invoices with credit cards, and the system will automatically track payment status and update invoices accordingly. 