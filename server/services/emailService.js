const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const fs = require('fs');
const path = require('path');

// Try to load config.js, fall back to config.example.js
let config;
try {
  config = require('../config.js');
} catch (error) {
  console.log('config.js not found, using example config');
  config = require('../config.example.js');
}

// Configure AWS SES client with proper error handling
let sesClient;
try {
  const awsAccessKeyId = config.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const awsSecretAccessKey = config.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  
  if (!awsAccessKeyId || !awsSecretAccessKey || 
      awsAccessKeyId.includes('your-aws-access-key') || 
      awsSecretAccessKey.includes('your-aws-secret-access-key')) {
    console.warn('AWS SES credentials not configured - email features will be disabled');
    sesClient = null;
  } else {
    sesClient = new SESClient({
      region: config.AWS_REGION || process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });
  }
} catch (error) {
  console.error('Failed to initialize AWS SES client:', error);
  sesClient = null;
}

class EmailService {
  static isAvailable() {
    return sesClient !== null;
  }

  static async sendEmail({ to, subject, htmlBody, textBody, from = null }) {
    if (!this.isAvailable()) {
      console.warn('Email service not available - AWS SES not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const fromEmail = from || config.FROM_EMAIL || process.env.FROM_EMAIL || 'noreply@yourdomain.com';
    
    const params = {
      Source: fromEmail,
      Destination: {
        ToAddresses: Array.isArray(to) ? to : [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          Text: {
            Data: textBody || htmlBody.replace(/<[^>]*>/g, ''), // Strip HTML for text version
            Charset: 'UTF-8',
          },
        },
      },
    };

    try {
      const command = new SendEmailCommand(params);
      const result = await sesClient.send(command);
      console.log('Email sent successfully:', result.MessageId);
      return { success: true, messageId: result.MessageId };
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  static async sendWelcomeEmail(user) {
    if (!this.isAvailable()) {
      console.warn('Cannot send welcome email - email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const subject = 'Welcome to AmpTrack!';
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #3B82F6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Welcome to AmpTrack!</h1>
        </div>
        <div class="content">
          <h2>Hello ${user.username}!</h2>
          <p>Welcome to AmpTrack - your complete electrical project management solution.</p>
          <p>Your account has been successfully created with the following details:</p>
          <ul>
            <li><strong>Username:</strong> ${user.username}</li>
            <li><strong>Email:</strong> ${user.email}</li>
            <li><strong>Role:</strong> ${user.role}</li>
          </ul>
          <p>You can now access the platform to:</p>
          <ul>
            <li>Manage electrical projects</li>
            <li>Create and send estimates</li>
            <li>Generate invoices</li>
            <li>Track project progress</li>
            <li>Manage customer relationships</li>
          </ul>
          <a href="${config.CLIENT_URL || process.env.CLIENT_URL || 'http://localhost:3000'}/login" class="button">Login to AmpTrack</a>
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
        </div>
        <div class="footer">
          <p>© 2024 AmpTrack. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      htmlBody,
    });
  }

  static async sendPasswordResetEmail(user, resetToken) {
    if (!this.isAvailable()) {
      console.warn('Cannot send password reset email - email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const resetUrl = `${config.CLIENT_URL || process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const subject = 'Password Reset Request - AmpTrack';
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { background-color: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .warning { background-color: #FEF3C7; border: 1px solid #F59E0B; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hello ${user.username}!</h2>
          <p>We received a request to reset your password for your AmpTrack account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" class="button">Reset Your Password</a>
          <div class="warning">
            <strong>Important:</strong> This link will expire in 1 hour for security reasons.
          </div>
          <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
          <p>For security reasons, please do not share this link with anyone.</p>
        </div>
        <div class="footer">
          <p>© 2024 AmpTrack. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      htmlBody,
    });
  }

  static async sendEstimateEmail(estimate, recipientEmail, senderName) {
    if (!this.isAvailable()) {
      console.warn('Cannot send estimate email - email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const subject = `Estimate #${estimate.id} from ${senderName}`;
    
    // Calculate totals for display
    const itemsHtml = estimate.items?.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${parseFloat(item.unit_price).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${parseFloat(item.total_price).toFixed(2)}</td>
      </tr>
    `).join('') || '';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .estimate-details { background-color: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .table th { background-color: #f3f4f6; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; }
          .table td { padding: 8px; border-bottom: 1px solid #ddd; }
          .totals { background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .total-row { display: flex; justify-content: space-between; margin: 5px 0; }
          .final-total { font-weight: bold; font-size: 18px; border-top: 2px solid #ddd; padding-top: 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
          .status-draft { background-color: #f3f4f6; color: #374151; }
          .status-sent { background-color: #dbeafe; color: #1d4ed8; }
          .status-approved { background-color: #d1fae5; color: #065f46; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Project Estimate</h1>
        </div>
        <div class="content">
          <div class="estimate-details">
            <h2>${estimate.title}</h2>
            ${estimate.description ? `<p><strong>Description:</strong> ${estimate.description}</p>` : ''}
            
            <div style="display: flex; justify-content: space-between; margin: 20px 0;">
              <div>
                <p><strong>Estimate ID:</strong> #${estimate.id}</p>
                <p><strong>Date:</strong> ${new Date(estimate.created_at).toLocaleDateString()}</p>
                <p><strong>Status:</strong> <span class="status-badge status-${estimate.status}">${estimate.status.toUpperCase()}</span></p>
                ${estimate.valid_until ? `<p><strong>Valid Until:</strong> ${new Date(estimate.valid_until).toLocaleDateString()}</p>` : ''}
              </div>
              <div style="text-align: right;">
                <h3>From: ${senderName}</h3>
                ${estimate.customer_name ? `<p><strong>To:</strong> ${estimate.customer_name}</p>` : ''}
              </div>
            </div>

            ${estimate.items && estimate.items.length > 0 ? `
              <table class="table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="text-align: center;">Quantity</th>
                    <th style="text-align: right;">Unit Price</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <div class="totals">
                <div class="total-row">
                  <span>Subtotal:</span>
                  <span>$${parseFloat(estimate.subtotal).toFixed(2)}</span>
                </div>
                <div class="total-row">
                  <span>Tax (${parseFloat(estimate.tax_rate).toFixed(1)}%):</span>
                  <span>$${parseFloat(estimate.tax_amount).toFixed(2)}</span>
                </div>
                <div class="total-row final-total">
                  <span>Total Amount:</span>
                  <span>$${parseFloat(estimate.total_amount).toFixed(2)}</span>
                </div>
              </div>
            ` : ''}

            ${estimate.notes ? `
              <div style="margin-top: 20px;">
                <h4>Notes:</h4>
                <p style="background-color: #f9fafb; padding: 15px; border-radius: 6px;">${estimate.notes}</p>
              </div>
            ` : ''}
          </div>

          <p>Thank you for considering our services. If you have any questions about this estimate, please don't hesitate to contact us.</p>
          <p>We look forward to working with you!</p>
        </div>
        <div class="footer">
          <p>© 2024 AmpTrack. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: recipientEmail,
      subject,
      htmlBody,
    });
  }

  static async sendChangeOrderEmail(changeOrder, recipientEmail, senderName) {
    if (!this.isAvailable()) {
      console.warn('Cannot send change order email - email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const subject = `Change Order ${changeOrder.change_order_number} from ${senderName}`;
    
    // Calculate totals for display
    const itemsHtml = changeOrder.items?.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${parseFloat(item.unit_price).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${parseFloat(item.total_price).toFixed(2)}</td>
      </tr>
    `).join('') || '';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; }
          .header { background-color: #F59E0B; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .change-order-details { background-color: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .table th { background-color: #f3f4f6; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; }
          .table td { padding: 8px; border-bottom: 1px solid #ddd; }
          .totals { background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .total-row { display: flex; justify-content: space-between; margin: 5px 0; }
          .final-total { font-weight: bold; font-size: 18px; border-top: 2px solid #ddd; padding-top: 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
          .status-draft { background-color: #f3f4f6; color: #374151; }
          .status-sent { background-color: #dbeafe; color: #1d4ed8; }
          .status-approved { background-color: #d1fae5; color: #065f46; }
          .status-rejected { background-color: #fecaca; color: #991b1b; }
          .notice-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Project Change Order</h1>
        </div>
        <div class="content">
          <div class="notice-box">
            <strong>Important Notice:</strong> This is a change order for additional work or modifications to the original project scope.
          </div>
          
          <div class="change-order-details">
            <h2>${changeOrder.title}</h2>
            ${changeOrder.description ? `<p><strong>Description:</strong> ${changeOrder.description}</p>` : ''}
            
            <div style="display: flex; justify-content: space-between; margin: 20px 0;">
              <div>
                <p><strong>Change Order #:</strong> ${changeOrder.change_order_number}</p>
                <p><strong>Project:</strong> ${changeOrder.project_name}</p>
                <p><strong>Date:</strong> ${new Date(changeOrder.created_at).toLocaleDateString()}</p>
                <p><strong>Status:</strong> <span class="status-badge status-${changeOrder.status}">${changeOrder.status.toUpperCase()}</span></p>
                ${changeOrder.requested_date ? `<p><strong>Requested Date:</strong> ${new Date(changeOrder.requested_date).toLocaleDateString()}</p>` : ''}
              </div>
              <div style="text-align: right;">
                <h3>From: ${senderName}</h3>
                ${changeOrder.customer_name ? `<p><strong>To:</strong> ${changeOrder.customer_name}</p>` : ''}
              </div>
            </div>

            ${changeOrder.reason ? `
              <div style="margin: 20px 0;">
                <h4>Reason for Change:</h4>
                <p style="background-color: #f9fafb; padding: 15px; border-radius: 6px;">${changeOrder.reason}</p>
              </div>
            ` : ''}

            ${changeOrder.justification ? `
              <div style="margin: 20px 0;">
                <h4>Justification:</h4>
                <p style="background-color: #f9fafb; padding: 15px; border-radius: 6px;">${changeOrder.justification}</p>
              </div>
            ` : ''}

            ${changeOrder.items && changeOrder.items.length > 0 ? `
              <table class="table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="text-align: center;">Quantity</th>
                    <th style="text-align: right;">Unit Price</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <div class="totals">
                <div class="total-row">
                  <span>Subtotal:</span>
                  <span>$${parseFloat(changeOrder.subtotal).toFixed(2)}</span>
                </div>
                <div class="total-row">
                  <span>Tax (${parseFloat(changeOrder.tax_rate).toFixed(1)}%):</span>
                  <span>$${parseFloat(changeOrder.tax_amount).toFixed(2)}</span>
                </div>
                <div class="total-row final-total">
                  <span>Total Change Order Amount:</span>
                  <span>$${parseFloat(changeOrder.total_amount).toFixed(2)}</span>
                </div>
              </div>
            ` : ''}

            ${changeOrder.notes ? `
              <div style="margin-top: 20px;">
                <h4>Additional Notes:</h4>
                <p style="background-color: #f9fafb; padding: 15px; border-radius: 6px;">${changeOrder.notes}</p>
              </div>
            ` : ''}
          </div>

          <p>Please review this change order carefully. This represents additional work beyond the original project scope and will affect the project timeline and total cost.</p>
          <p>If you have any questions about this change order, please don't hesitate to contact us.</p>
        </div>
        <div class="footer">
          <p>© 2024 AmpTrack. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: recipientEmail,
      subject,
      htmlBody,
    });
  }

  static async sendRFIEmail({ project, customer, contact, sender, rfi }) {
    if (!this.isAvailable()) {
      console.warn('Cannot send RFI email - email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const subject = rfi.subject;
    const priorityColor = rfi.priority === 'high' ? '#EF4444' : rfi.priority === 'medium' ? '#F59E0B' : '#10B981';
    const priorityText = rfi.priority.charAt(0).toUpperCase() + rfi.priority.slice(1);

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #3B82F6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .info-section { background-color: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .message-section { background-color: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3B82F6; }
          .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; color: white; font-size: 12px; font-weight: bold; }
          .response-section { background-color: #FEF3C7; border: 1px solid #F59E0B; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Request for Information (RFI)</h1>
        </div>
        <div class="content">
          <p>Dear ${contact.first_name} ${contact.last_name},</p>
          
          <p>We have a request for information regarding the following project:</p>
          
          <div class="info-section">
            <p><strong>Project:</strong> ${project.name}</p>
            <p><strong>Description:</strong> ${project.description}</p>
            <p><strong>Location:</strong> ${project.location || 'N/A'}</p>
            <p><strong>RFI ID:</strong> #${rfi.id}</p>
            <p><strong>From:</strong> ${sender.username} (${sender.email})</p>
            <p><strong>Date:</strong> ${new Date(rfi.created_at).toLocaleDateString()}</p>
            <p><strong>Priority:</strong> <span class="priority-badge" style="background-color: ${priorityColor};">${priorityText}</span></p>
            ${rfi.response_needed_by ? `<p><strong>Response Needed By:</strong> ${new Date(rfi.response_needed_by).toLocaleDateString()}</p>` : ''}
          </div>
          
          <div class="message-section">
            <h3>Request Details:</h3>
            <p style="white-space: pre-wrap;">${rfi.message}</p>
          </div>
          
          ${rfi.response_needed_by ? `
            <div class="response-section">
              <strong>Please Note:</strong> A response is requested by ${new Date(rfi.response_needed_by).toLocaleDateString()}.
            </div>
          ` : ''}
          
          <p>Please reply to this email with the requested information at your earliest convenience.</p>
          <p>If you have any questions or need clarification, please don't hesitate to contact us.</p>
          <p>Thank you for your prompt attention to this matter.</p>
          
          <p>Best regards,<br>
          ${sender.username}<br>
          ${sender.email}</p>
        </div>
        <div class="footer">
          <p>© 2024 AmpTrack. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: contact.email,
      subject,
      htmlBody,
    });
  }
}

module.exports = EmailService; 