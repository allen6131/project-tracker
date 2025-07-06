// Copy this file to config.js and update with your actual values
module.exports = {
  PORT: process.env.PORT || 6000,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/project_tracker',
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // AWS SES Configuration for Email Services
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || 'your-aws-access-key-id',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || 'your-aws-secret-access-key',
  FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
  
  // Client URL for email links
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  
  // Stripe Configuration for Payment Processing
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_your_stripe_secret_key_here',
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_your_stripe_publishable_key_here',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_your_webhook_secret_here',
};

// For Neon Database, your DATABASE_URL will look like:
// postgresql://username:password@ep-xxx-xxx-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require 