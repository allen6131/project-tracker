# Deployment Troubleshooting Guide

This guide helps diagnose and fix common deployment issues with the AmpTrack backend.

## Quick Diagnosis

Run the configuration check script to quickly identify issues:

```bash
npm run check-config
```

This will show you exactly what's missing or misconfigured.

## Common Deployment Issues

### 1. Database Connection Failures

**Symptoms:**
- Server crashes on startup
- "Error connecting to the database" messages
- Process exits with code 1

**Solutions:**
- Ensure `DATABASE_URL` environment variable is set
- For Neon/PostgreSQL: `postgresql://username:password@host:port/database?sslmode=require`
- Check if database is accessible from deployment environment
- Verify SSL settings for production databases

### 2. JWT Authentication Issues

**Symptoms:**
- "Token verification failed" errors
- Authentication not working
- Server crashes on login attempts

**Solutions:**
- Set `JWT_SECRET` environment variable to a strong secret
- Ensure `JWT_EXPIRES_IN` is configured (default: '7d')
- Use a long, random string for production

### 3. Email Service Disabled

**Symptoms:**
- "Email service not available" messages
- Welcome emails not sent
- Password reset emails not working

**Expected Behavior:**
- Server runs normally but email features are disabled
- Users still get created but no welcome emails
- Password resets work but no emails are sent

**To Enable:**
- Configure AWS SES credentials
- Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- Set `FROM_EMAIL` for sending emails

### 4. Payment Processing Disabled

**Symptoms:**
- "Payment processing is currently unavailable" errors
- Stripe features not working

**Expected Behavior:**
- Server runs normally but payment features return 503 errors
- Invoice creation works but payment processing is disabled

**To Enable:**
- Configure Stripe API keys
- Set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
- Set `STRIPE_WEBHOOK_SECRET` for webhooks

### 5. Port Configuration Issues

**Symptoms:**
- "Port already in use" errors
- Server won't start

**Solutions:**
- Set `PORT` environment variable
- Default port is 6000 if not specified
- Ensure port is available and not blocked

## Environment Variables

### Required (Server won't start without these):
```bash
DATABASE_URL=postgresql://user:pass@host:port/dbname?sslmode=require
JWT_SECRET=your-super-secret-jwt-key
```

### Optional (Features disabled if missing):
```bash
# Email Service (AWS SES)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
FROM_EMAIL=noreply@yourdomain.com

# Payment Processing (Stripe)
STRIPE_SECRET_KEY=sk_live_or_test_key
STRIPE_PUBLISHABLE_KEY=pk_live_or_test_key
STRIPE_WEBHOOK_SECRET=whsec_webhook_secret

# Other
NODE_ENV=production
CLIENT_URL=https://yourdomain.com
PORT=6000
```

## Configuration Methods

### Method 1: Environment Variables (Recommended for deployment)
Set environment variables in your deployment platform.

### Method 2: Config File (For local development)
Create `server/config.js`:
```javascript
module.exports = {
  PORT: process.env.PORT || 6000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV || 'production',
  
  // Optional services
  AWS_REGION: process.env.AWS_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  FROM_EMAIL: process.env.FROM_EMAIL,
  
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  
  CLIENT_URL: process.env.CLIENT_URL,
};
```

## Graceful Degradation

The application is designed to start and run even when optional services are not configured:

- **Email Service Unavailable**: Server runs, but email features return appropriate error messages
- **Payment Service Unavailable**: Server runs, but payment endpoints return 503 status codes
- **Database Unavailable**: Server will not start (this is intentional for data integrity)

## Logs and Debugging

The server logs helpful information on startup:
```
Server running on port 6000
Environment: production
Database configured: true
Email service available: false
Payment service available: true
```

This tells you immediately which services are working.

## Testing Deployment

1. Run configuration check: `npm run check-config`
2. Test database connection: Try starting the server
3. Test API endpoints: Check `/api/health` endpoint
4. Verify feature availability in logs

## Common Platform-Specific Issues

### Vercel
- Set environment variables in Vercel dashboard
- Ensure `NODE_ENV=production`
- Database must be accessible from Vercel's IP ranges

### Heroku
- Use Heroku Config Vars for environment variables
- Port is automatically set by Heroku
- Add PostgreSQL addon or use external database

### Railway/Render
- Set environment variables in project settings
- Ensure proper database connection strings
- Check service region compatibility

## Getting Help

If you're still experiencing issues:

1. Run `npm run check-config` and share the output
2. Check server logs for specific error messages
3. Verify all required environment variables are set
4. Test database connectivity separately
5. Check if services are accessible from deployment environment 