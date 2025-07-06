# AWS SES Setup for AmpTrack Email Services

This guide will help you set up Amazon Simple Email Service (SES) to enable email functionality in AmpTrack including:
- Estimate emails to customers
- Welcome emails for new users  
- Password reset emails

## Prerequisites

1. An AWS account
2. AWS CLI installed (optional but recommended)
3. Domain verification or email address verification in SES

## Step 1: Create AWS Account and Set Up SES

### 1.1 Sign up for AWS
- Go to [aws.amazon.com](https://aws.amazon.com) and create an account
- Navigate to the SES console in your preferred region (e.g., us-east-1)

### 1.2 Verify Your Domain or Email Address

#### Option A: Verify a Domain (Recommended for production)
1. In SES console, go to "Verified identities"
2. Click "Create identity" → "Domain"
3. Enter your domain (e.g., `yourdomain.com`)
4. Add the required DNS records to verify ownership
5. Wait for verification (can take up to 72 hours)

#### Option B: Verify Email Address (For testing)
1. In SES console, go to "Verified identities"
2. Click "Create identity" → "Email address"
3. Enter your email address
4. Check your email and click the verification link

### 1.3 Request Production Access (Important!)
By default, SES starts in "sandbox mode" which only allows sending to verified email addresses.

1. In SES console, go to "Account dashboard"
2. Click "Request production access"
3. Fill out the form explaining your use case
4. Wait for approval (usually 24-48 hours)

## Step 2: Create IAM User for SES

### 2.1 Create IAM User
1. Go to IAM console
2. Click "Users" → "Add users"
3. Enter username (e.g., `amptrack-ses-user`)
4. Select "Access key - Programmatic access"

### 2.2 Attach SES Permissions
1. Choose "Attach existing policies directly"
2. Search for and select `AmazonSESFullAccess`
3. Complete user creation
4. **Important**: Save the Access Key ID and Secret Access Key

## Step 3: Configure AmpTrack

### 3.1 Update Configuration File
Copy `config.example.js` to `config.js` and update the following:

```javascript
module.exports = {
  // ... existing config ...
  
  // AWS SES Configuration
  AWS_REGION: 'us-east-1', // Your SES region
  AWS_ACCESS_KEY_ID: 'your-access-key-id',
  AWS_SECRET_ACCESS_KEY: 'your-secret-access-key',
  FROM_EMAIL: 'noreply@yourdomain.com', // Must be verified in SES
  
  // Client URL for email links
  CLIENT_URL: 'https://yourdomain.com', // Your frontend URL
};
```

### 3.2 Environment Variables (Alternative)
Instead of hardcoding in config.js, you can use environment variables:

```bash
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your-access-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-access-key
export FROM_EMAIL=noreply@yourdomain.com
export CLIENT_URL=https://yourdomain.com
```

## Step 4: Test Email Functionality

### 4.1 Test Welcome Email
1. Create a new user through the admin panel
2. Check if the welcome email is sent

### 4.2 Test Password Reset
1. Use the "Forgot Password" feature
2. Check if the reset email is received

### 4.3 Test Estimate Email
1. Create an estimate
2. Use the "Send Email" button
3. Verify the estimate email is delivered

## Troubleshooting

### Common Issues

#### 1. "Email address not verified" error
- **Solution**: Verify your FROM_EMAIL address in SES console

#### 2. "MessageRejected: Email address not verified" 
- **Solution**: If in sandbox mode, recipient email must also be verified, or request production access

#### 3. "InvalidParameterValue: 'your-domain.com' is not verified"
- **Solution**: Complete domain verification in SES

#### 4. High bounce rate
- **Solution**: 
  - Use double opt-in for email lists
  - Keep email lists clean
  - Monitor SES reputation dashboard

### SES Limits
- **Sandbox mode**: 200 emails per 24 hours, 1 email per second
- **Production mode**: Starts at 200 emails per 24 hours, can request increases
- **Rate limits**: Start at 1 email per second, can request increases

## Security Best Practices

1. **IAM Permissions**: Use least privilege principle
2. **Key Rotation**: Regularly rotate AWS access keys
3. **Environment Variables**: Don't commit credentials to version control
4. **Monitoring**: Set up CloudWatch alarms for bounce/complaint rates

## Production Considerations

### 1. Email Templates
- Customize email templates in `server/services/emailService.js`
- Add your branding and styling
- Test on multiple email clients

### 2. Monitoring
- Set up CloudWatch dashboards
- Monitor bounce and complaint rates
- Set up SNS notifications for issues

### 3. Compliance
- Include unsubscribe links where appropriate
- Follow CAN-SPAM and GDPR guidelines
- Maintain suppression lists

### 4. Performance
- Consider using SES templates for high volume
- Implement email queuing for large batches
- Use SES configuration sets for tracking

## Cost Information

SES pricing (as of 2024):
- First 62,000 emails per month: $0.10 per 1,000 emails
- Beyond 62,000: $0.12 per 1,000 emails
- Data transfer: $0.12 per GB

For most small to medium businesses, costs will be minimal.

## Support

For AWS SES specific issues:
- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
- [AWS Support Center](https://console.aws.amazon.com/support/)

For AmpTrack specific issues:
- Check server logs for detailed error messages
- Ensure all configuration values are correct
- Test with verified email addresses first 