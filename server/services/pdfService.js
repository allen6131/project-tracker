const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Try to load config.js, fall back to config.example.js
let config;
try {
  config = require('../config.js');
} catch (error) {
  config = require('../config.example.js');
}

class PDFService {
  // Helper method to get company profile
  static async getCompanyProfile(db) {
    try {
      console.log('PDFService: Fetching company profile...');
      const result = await db.query(
        'SELECT * FROM company_profiles ORDER BY id DESC LIMIT 1'
      );
      
      console.log('PDFService: Company profile query result:', {
        rowCount: result.rows.length,
        data: result.rows[0] || 'No data found'
      });
      
      if (result.rows.length > 0) {
        const profile = result.rows[0];
        console.log('PDFService: Using database company profile:', {
          company_name: profile.company_name,
          address: profile.address,
          city: profile.city,
          phone: profile.phone,
          email: profile.email,
          website: profile.website,
          logo_url: profile.logo_url
        });
        return profile;
      }
      
      // Return default values if no profile exists
      console.log('PDFService: No company profile found, using defaults');
      return {
        company_name: 'AmpTrack',
        footer_text: 'Thank you for your business!',
        logo_url: null,
        email: null,
        phone: null,
        website: null,
        address: null,
        city: null,
        state: null,
        postal_code: null,
        country: null
      };
    } catch (error) {
      console.error('PDFService: Error fetching company profile:', error);
      // Return default values on error
      return {
        company_name: 'AmpTrack',
        footer_text: 'Thank you for your business!',
        logo_url: null
      };
    }
  }

  static async generateEstimatePDF(estimate, db) {
    let browser;
    try {
      // Validate estimate data
      if (!estimate || !estimate.id) {
        throw new Error('Invalid estimate data: missing estimate or ID');
      }
      
      console.log(`Starting PDF generation for estimate ${estimate.id}`);
      
      // Get company profile
      const companyProfile = await this.getCompanyProfile(db);
      
      // Puppeteer launch options optimized for Heroku
      const launchOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      };
      
      // For Heroku, we need to use the Chrome binary installed by the buildpack
      if (process.env.GOOGLE_CHROME_BIN) {
        launchOptions.executablePath = process.env.GOOGLE_CHROME_BIN;
        console.log('Using Chrome binary from GOOGLE_CHROME_BIN:', process.env.GOOGLE_CHROME_BIN);
      } else if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        console.log('Using Chrome binary from PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH);
      }
      
      // Additional args for Heroku
      if (process.env.DYNO) {
        launchOptions.args.push('--single-process');
        console.log('Running on Heroku, added single-process flag');
      }
      
      browser = await puppeteer.launch(launchOptions);
      
      const page = await browser.newPage();
      
      // Set a timeout for the page operations
      page.setDefaultTimeout(30000);
      
      const html = this.generateEstimateHTML(estimate, companyProfile);
      
      if (!html || html.length === 0) {
        throw new Error('Generated HTML is empty');
      }
      
      console.log(`Setting page content for estimate ${estimate.id}`);
      await page.setContent(html, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      
      console.log(`Generating PDF for estimate ${estimate.id}`);
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Generated PDF buffer is empty');
      }
      
      console.log(`PDF generation completed for estimate ${estimate.id}, size: ${pdfBuffer.length} bytes`);
      return pdfBuffer;
    } catch (error) {
      console.error('Error generating estimate PDF:', error);
      throw new Error(`Failed to generate estimate PDF: ${error.message}`);
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
    }
  }

  static async generateInvoicePDF(invoice, db) {
    let browser;
    try {
      // Get company profile
      const companyProfile = await this.getCompanyProfile(db);
      
      // Puppeteer launch options optimized for Heroku
      const launchOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      };
      
      // For Heroku, we need to use the Chrome binary installed by the buildpack
      if (process.env.GOOGLE_CHROME_BIN) {
        launchOptions.executablePath = process.env.GOOGLE_CHROME_BIN;
        console.log('Using Chrome binary from GOOGLE_CHROME_BIN:', process.env.GOOGLE_CHROME_BIN);
      } else if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        console.log('Using Chrome binary from PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH);
      }
      
      // Additional args for Heroku
      if (process.env.DYNO) {
        launchOptions.args.push('--single-process');
        console.log('Running on Heroku, added single-process flag');
      }
      
      browser = await puppeteer.launch(launchOptions);
      
      const page = await browser.newPage();
      
      const html = this.generateInvoiceHTML(invoice, companyProfile);
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      
      return pdfBuffer;
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      throw new Error('Failed to generate invoice PDF');
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  static generateEstimateHTML(estimate, companyProfile) {
    console.log('PDFService: generateEstimateHTML called with company profile:', {
      company_name: companyProfile?.company_name,
      address: companyProfile?.address,
      city: companyProfile?.city,
      phone: companyProfile?.phone,
      email: companyProfile?.email,
      website: companyProfile?.website,
      logo_url: companyProfile?.logo_url
    });
    
    const formatCurrency = (amount) => {
      const numAmount = parseFloat(amount) || 0;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(numAmount);
    };

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      try {
        return new Date(dateString).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch (error) {
        return 'Invalid Date';
      }
    };

    const escapeHtml = (text) => {
      if (!text) return '';
      return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    // Generate logo HTML
    const logoHtml = companyProfile.logo_url ? 
      `<img src="${process.env.BASE_URL || 'http://localhost:5000'}${companyProfile.logo_url}" alt="${escapeHtml(companyProfile.company_name)} Logo" style="max-height: 60px; max-width: 200px; margin-bottom: 10px;">` :
      `<div class="company-name">${escapeHtml(companyProfile.company_name)}</div>`;

    // Generate company contact information
    const generateCompanyAddress = () => {
      const addressParts = [];
      if (companyProfile.address) addressParts.push(escapeHtml(companyProfile.address));
      if (companyProfile.city) {
        let cityLine = escapeHtml(companyProfile.city);
        if (companyProfile.state) cityLine += `, ${escapeHtml(companyProfile.state)}`;
        if (companyProfile.postal_code) cityLine += ` ${escapeHtml(companyProfile.postal_code)}`;
        addressParts.push(cityLine);
      }
      if (companyProfile.country) addressParts.push(escapeHtml(companyProfile.country));
      const result = addressParts.length > 0 ? addressParts.join('<br>') : '';
      console.log('PDFService: generateCompanyAddress result:', result);
      return result;
    };

    const generateCompanyContacts = () => {
      const contacts = [];
      if (companyProfile.phone) contacts.push(`<strong>Phone:</strong> ${escapeHtml(companyProfile.phone)}`);
      if (companyProfile.email) contacts.push(`<strong>Email:</strong> ${escapeHtml(companyProfile.email)}`);
      if (companyProfile.website) contacts.push(`<strong>Website:</strong> ${escapeHtml(companyProfile.website)}`);
      const result = contacts.length > 0 ? contacts.join('<br>') : '';
      console.log('PDFService: generateCompanyContacts result:', result);
      return result;
    };

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Estimate #${estimate.id}</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            line-height: 1.6;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #2563eb;
          }
          .company-info {
            flex: 1;
            text-align: left;
          }
          .company-name {
            font-size: 28px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
          }
          .company-address {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 10px;
            line-height: 1.4;
          }
          .company-contacts {
            font-size: 14px;
            color: #6b7280;
            line-height: 1.4;
          }
          .document-title-section {
            flex: 1;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .document-title {
            font-size: 24px;
            font-weight: bold;
            color: #374151;
            margin-bottom: 10px;
          }
          .estimate-number {
            font-size: 18px;
            color: #6b7280;
            font-weight: normal;
          }
          .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .info-box {
            width: 48%;
          }
          .info-box h3 {
            margin: 0 0 10px 0;
            color: #2563eb;
            font-size: 16px;
            font-weight: bold;
          }
          .info-box p {
            margin: 5px 0;
            font-size: 14px;
          }
          .estimate-details {
            background-color: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .estimate-details h3 {
            margin-top: 0;
            color: #2563eb;
            font-size: 18px;
          }
          .amount-section {
            background-color: #f0f9ff;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 30px;
          }
          .amount-label {
            font-size: 16px;
            color: #6b7280;
            margin-bottom: 10px;
          }
          .amount-value {
            font-size: 32px;
            font-weight: bold;
            color: #2563eb;
          }
          .notes-section {
            background-color: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .notes-section h3 {
            margin-top: 0;
            color: #374151;
            font-size: 16px;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .status-draft {
            background-color: #fef3c7;
            color: #92400e;
          }
          .status-sent {
            background-color: #dbeafe;
            color: #1e40af;
          }
          .status-approved {
            background-color: #d1fae5;
            color: #065f46;
          }
          .status-rejected {
            background-color: #fecaca;
            color: #991b1b;
          }
          .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            ${logoHtml}
            ${generateCompanyAddress() ? `<div class="company-address">${generateCompanyAddress()}</div>` : ''}
            ${generateCompanyContacts() ? `<div class="company-contacts">${generateCompanyContacts()}</div>` : ''}
          </div>
          <div class="document-title-section">
            <div class="document-title">Project Estimate</div>
            <div class="estimate-number">#${estimate.id}</div>
          </div>
        </div>

        <div class="info-section">
          <div class="info-box">
            <h3>Estimate Information</h3>
            <p><strong>Date:</strong> ${formatDate(estimate.created_at)}</p>
            <p><strong>Status:</strong> <span class="status-badge status-${estimate.status || 'draft'}">${escapeHtml(estimate.status) || 'draft'}</span></p>
            ${estimate.project_name ? `<p><strong>Project:</strong> ${escapeHtml(estimate.project_name)}</p>` : ''}
          </div>
          <div class="info-box">
            <h3>Customer Information</h3>
            <p><strong>Customer:</strong> ${escapeHtml(estimate.customer_name) || 'N/A'}</p>
            <p><strong>Created by:</strong> ${escapeHtml(estimate.created_by_username) || 'System'}</p>
          </div>
        </div>

        <div class="estimate-details">
          <h3>${escapeHtml(estimate.title) || 'Untitled Estimate'}</h3>
          ${estimate.description ? `<p><strong>Description:</strong> ${escapeHtml(estimate.description)}</p>` : ''}
        </div>

        <div class="amount-section">
          <div class="amount-label">Total Estimate Amount</div>
          <div class="amount-value">${formatCurrency(estimate.total_amount)}</div>
        </div>

        ${estimate.notes ? `
          <div class="notes-section">
            <h3>Additional Notes</h3>
            <p>${escapeHtml(estimate.notes)}</p>
          </div>
        ` : ''}

        <div class="footer">
          <p>${escapeHtml(companyProfile.footer_text || 'Thank you for considering our services. If you have any questions about this estimate, please don\'t hesitate to contact us.')}</p>
          <p>&copy; ${new Date().getFullYear()} ${escapeHtml(companyProfile.company_name)}. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }

  static generateInvoiceHTML(invoice, companyProfile) {
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    };

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const escapeHtml = (text) => {
      if (!text) return '';
      return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    // Generate logo HTML
    const logoHtml = companyProfile.logo_url ? 
      `<img src="${process.env.BASE_URL || 'http://localhost:5000'}${companyProfile.logo_url}" alt="${escapeHtml(companyProfile.company_name)} Logo" style="max-height: 60px; max-width: 200px; margin-bottom: 10px;">` :
      `<div class="company-name">${escapeHtml(companyProfile.company_name)}</div>`;

    // Generate company contact information
    const generateCompanyAddress = () => {
      const addressParts = [];
      if (companyProfile.address) addressParts.push(escapeHtml(companyProfile.address));
      if (companyProfile.city) {
        let cityLine = escapeHtml(companyProfile.city);
        if (companyProfile.state) cityLine += `, ${escapeHtml(companyProfile.state)}`;
        if (companyProfile.postal_code) cityLine += ` ${escapeHtml(companyProfile.postal_code)}`;
        addressParts.push(cityLine);
      }
      if (companyProfile.country) addressParts.push(escapeHtml(companyProfile.country));
      return addressParts.length > 0 ? addressParts.join('<br>') : '';
    };

    const generateCompanyContacts = () => {
      const contacts = [];
      if (companyProfile.phone) contacts.push(`<strong>Phone:</strong> ${escapeHtml(companyProfile.phone)}`);
      if (companyProfile.email) contacts.push(`<strong>Email:</strong> ${escapeHtml(companyProfile.email)}`);
      if (companyProfile.website) contacts.push(`<strong>Website:</strong> ${escapeHtml(companyProfile.website)}`);
      return contacts.length > 0 ? contacts.join('<br>') : '';
    };

    const itemsHTML = invoice.items && invoice.items.length > 0 ? 
      invoice.items.map(item => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.description)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.total_price)}</td>
        </tr>
      `).join('') : 
      '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #6b7280;">No items</td></tr>';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${invoice.invoice_number}</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            line-height: 1.6;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #2563eb;
          }
          .company-info {
            flex: 1;
            text-align: left;
          }
          .company-name {
            font-size: 28px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
          }
          .company-address {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 10px;
            line-height: 1.4;
          }
          .company-contacts {
            font-size: 14px;
            color: #6b7280;
            line-height: 1.4;
          }
          .document-title-section {
            flex: 1;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .document-title {
            font-size: 24px;
            font-weight: bold;
            color: #374151;
            margin-bottom: 10px;
          }
          .invoice-number {
            font-size: 18px;
            color: #6b7280;
            font-weight: normal;
          }
          .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .info-box {
            width: 48%;
          }
          .info-box h3 {
            margin: 0 0 10px 0;
            color: #2563eb;
            font-size: 16px;
            font-weight: bold;
          }
          .info-box p {
            margin: 5px 0;
            font-size: 14px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          .items-table th {
            background-color: #f3f4f6;
            padding: 12px;
            text-align: left;
            font-weight: bold;
            color: #374151;
            border-bottom: 2px solid #e5e7eb;
          }
          .items-table th:last-child,
          .items-table td:last-child {
            text-align: right;
          }
          .items-table th:nth-child(2),
          .items-table td:nth-child(2) {
            text-align: center;
          }
          .totals-section {
            background-color: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 16px;
          }
          .total-row.final {
            font-weight: bold;
            font-size: 18px;
            padding-top: 10px;
            border-top: 2px solid #2563eb;
            margin-top: 10px;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .status-draft {
            background-color: #fef3c7;
            color: #92400e;
          }
          .status-sent {
            background-color: #dbeafe;
            color: #1e40af;
          }
          .status-paid {
            background-color: #d1fae5;
            color: #065f46;
          }
          .status-overdue {
            background-color: #fecaca;
            color: #991b1b;
          }
          .notes-section {
            background-color: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .notes-section h3 {
            margin-top: 0;
            color: #374151;
            font-size: 16px;
          }
          .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            ${logoHtml}
            ${generateCompanyAddress() ? `<div class="company-address">${generateCompanyAddress()}</div>` : ''}
            ${generateCompanyContacts() ? `<div class="company-contacts">${generateCompanyContacts()}</div>` : ''}
          </div>
          <div class="document-title-section">
            <div class="document-title">Invoice</div>
            <div class="invoice-number">${invoice.invoice_number}</div>
          </div>
        </div>

        <div class="info-section">
          <div class="info-box">
            <h3>Invoice Information</h3>
            <p><strong>Date:</strong> ${formatDate(invoice.created_at)}</p>
            <p><strong>Status:</strong> <span class="status-badge status-${invoice.status}">${invoice.status}</span></p>
            ${invoice.due_date ? `<p><strong>Due Date:</strong> ${formatDate(invoice.due_date)}</p>` : ''}
            ${invoice.project_name ? `<p><strong>Project:</strong> ${escapeHtml(invoice.project_name)}</p>` : ''}
          </div>
          <div class="info-box">
            <h3>Bill To</h3>
            <p><strong>${escapeHtml(invoice.customer_name) || 'N/A'}</strong></p>
            ${invoice.customer_email ? `<p>${escapeHtml(invoice.customer_email)}</p>` : ''}
            ${invoice.customer_phone ? `<p>${escapeHtml(invoice.customer_phone)}</p>` : ''}
            ${invoice.customer_address ? `<p>${escapeHtml(invoice.customer_address)}</p>` : ''}
          </div>
        </div>

        <h3 style="color: #2563eb; margin-bottom: 15px;">${escapeHtml(invoice.title)}</h3>
        ${invoice.description ? `<p style="margin-bottom: 20px; color: #6b7280;">${escapeHtml(invoice.description)}</p>` : ''}

        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>${formatCurrency(invoice.subtotal)}</span>
          </div>
          <div class="total-row">
            <span>Tax (${invoice.tax_rate}%):</span>
            <span>${formatCurrency(invoice.tax_amount)}</span>
          </div>
          <div class="total-row final">
            <span>Total Amount:</span>
            <span>${formatCurrency(invoice.total_amount)}</span>
          </div>
        </div>

        ${invoice.notes ? `
          <div class="notes-section">
            <h3>Notes</h3>
            <p>${escapeHtml(invoice.notes)}</p>
          </div>
        ` : ''}

        <div class="footer">
          <p>${escapeHtml(companyProfile.footer_text || 'Thank you for your business!')}</p>
          <p>&copy; ${new Date().getFullYear()} ${escapeHtml(companyProfile.company_name)}. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }

  static async generateChangeOrderPDF(changeOrder, db) {
    let browser;
    try {
      // Validate change order data
      if (!changeOrder || !changeOrder.id) {
        throw new Error('Invalid change order data: missing change order or ID');
      }
      
      console.log(`Starting PDF generation for change order ${changeOrder.id}`);
      
      // Get company profile
      const companyProfile = await this.getCompanyProfile(db);
      
      // Puppeteer launch options optimized for Heroku
      const launchOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      };
      
      // For Heroku, we need to use the Chrome binary installed by the buildpack
      if (process.env.GOOGLE_CHROME_BIN) {
        launchOptions.executablePath = process.env.GOOGLE_CHROME_BIN;
        console.log('Using Chrome binary from GOOGLE_CHROME_BIN:', process.env.GOOGLE_CHROME_BIN);
      } else if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        console.log('Using Chrome binary from PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH);
      }
      
      // Additional args for Heroku
      if (process.env.DYNO) {
        launchOptions.args.push('--single-process');
        console.log('Running on Heroku, added single-process flag');
      }
      
      browser = await puppeteer.launch(launchOptions);
      
      const page = await browser.newPage();
      
      // Set a timeout for the page operations
      page.setDefaultTimeout(30000);
      
      const html = this.generateChangeOrderHTML(changeOrder, companyProfile);
      
      if (!html || html.length === 0) {
        throw new Error('Generated HTML is empty');
      }
      
      console.log(`Setting page content for change order ${changeOrder.id}`);
      await page.setContent(html, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      
      console.log(`Generating PDF for change order ${changeOrder.id}`);
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Generated PDF buffer is empty');
      }
      
      console.log(`PDF generation completed for change order ${changeOrder.id}, size: ${pdfBuffer.length} bytes`);
      return pdfBuffer;
    } catch (error) {
      console.error('Error generating change order PDF:', error);
      throw new Error(`Failed to generate change order PDF: ${error.message}`);
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
    }
  }

  static generateChangeOrderHTML(changeOrder, companyProfile) {
    const formatCurrency = (amount) => {
      const numAmount = parseFloat(amount) || 0;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(numAmount);
    };

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      try {
        return new Date(dateString).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch (error) {
        return 'Invalid Date';
      }
    };

    const escapeHtml = (text) => {
      if (!text) return '';
      return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    // Generate logo HTML
    const logoHtml = companyProfile.logo_url ? 
      `<img src="${process.env.BASE_URL || 'http://localhost:5000'}${companyProfile.logo_url}" alt="${escapeHtml(companyProfile.company_name)} Logo" style="max-height: 60px; max-width: 200px; margin-bottom: 10px;">` :
      `<div class="company-name">${escapeHtml(companyProfile.company_name)}</div>`;

    // Generate company contact information
    const generateCompanyAddress = () => {
      const addressParts = [];
      if (companyProfile.address) addressParts.push(escapeHtml(companyProfile.address));
      if (companyProfile.city) {
        let cityLine = escapeHtml(companyProfile.city);
        if (companyProfile.state) cityLine += `, ${escapeHtml(companyProfile.state)}`;
        if (companyProfile.postal_code) cityLine += ` ${escapeHtml(companyProfile.postal_code)}`;
        addressParts.push(cityLine);
      }
      if (companyProfile.country) addressParts.push(escapeHtml(companyProfile.country));
      return addressParts.length > 0 ? addressParts.join('<br>') : '';
    };

    const generateCompanyContacts = () => {
      const contacts = [];
      if (companyProfile.phone) contacts.push(`<strong>Phone:</strong> ${escapeHtml(companyProfile.phone)}`);
      if (companyProfile.email) contacts.push(`<strong>Email:</strong> ${escapeHtml(companyProfile.email)}`);
      if (companyProfile.website) contacts.push(`<strong>Website:</strong> ${escapeHtml(companyProfile.website)}`);
      return contacts.length > 0 ? contacts.join('<br>') : '';
    };

    const itemsHTML = changeOrder.items && changeOrder.items.length > 0 ? 
      changeOrder.items.map(item => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.description)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.total_price)}</td>
        </tr>
      `).join('') : 
      '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #6b7280;">No items</td></tr>';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Change Order ${changeOrder.change_order_number}</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            line-height: 1.6;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f59e0b;
          }
          .company-info {
            flex: 1;
            text-align: left;
          }
          .company-name {
            font-size: 28px;
            font-weight: bold;
            color: #f59e0b;
            margin-bottom: 10px;
          }
          .company-address {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 10px;
            line-height: 1.4;
          }
          .company-contacts {
            font-size: 14px;
            color: #6b7280;
            line-height: 1.4;
          }
          .document-title-section {
            flex: 1;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .document-title {
            font-size: 24px;
            font-weight: bold;
            color: #374151;
            margin-bottom: 10px;
          }
          .change-order-number {
            font-size: 18px;
            color: #6b7280;
            font-weight: normal;
          }
          .alert-box {
            background-color: #fef3c7;
            border: 2px solid #f59e0b;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 30px;
            text-align: center;
            font-weight: bold;
            color: #92400e;
          }
          .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .info-box {
            width: 48%;
          }
          .info-box h3 {
            margin: 0 0 10px 0;
            color: #f59e0b;
            font-size: 16px;
            font-weight: bold;
          }
          .info-box p {
            margin: 5px 0;
            font-size: 14px;
          }
          .change-details {
            background-color: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .change-details h3 {
            margin-top: 0;
            color: #f59e0b;
            font-size: 18px;
          }
          .reason-section {
            background-color: #fffbeb;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #f59e0b;
          }
          .reason-section h4 {
            margin-top: 0;
            color: #92400e;
            font-size: 16px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          .items-table th {
            background-color: #f3f4f6;
            padding: 12px;
            text-align: left;
            font-weight: bold;
            color: #374151;
            border-bottom: 2px solid #e5e7eb;
          }
          .items-table th:last-child,
          .items-table td:last-child {
            text-align: right;
          }
          .items-table th:nth-child(2),
          .items-table td:nth-child(2) {
            text-align: center;
          }
          .totals-section {
            background-color: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 16px;
          }
          .total-row.final {
            font-weight: bold;
            font-size: 18px;
            padding-top: 10px;
            border-top: 2px solid #f59e0b;
            margin-top: 10px;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .status-draft {
            background-color: #fef3c7;
            color: #92400e;
          }
          .status-sent {
            background-color: #dbeafe;
            color: #1e40af;
          }
          .status-approved {
            background-color: #d1fae5;
            color: #065f46;
          }
          .status-rejected {
            background-color: #fecaca;
            color: #991b1b;
          }
          .notes-section {
            background-color: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .notes-section h3 {
            margin-top: 0;
            color: #374151;
            font-size: 16px;
          }
          .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            ${logoHtml}
            ${generateCompanyAddress() ? `<div class="company-address">${generateCompanyAddress()}</div>` : ''}
            ${generateCompanyContacts() ? `<div class="company-contacts">${generateCompanyContacts()}</div>` : ''}
          </div>
          <div class="document-title-section">
            <div class="document-title">Change Order</div>
            <div class="change-order-number">${escapeHtml(changeOrder.change_order_number)}</div>
          </div>
        </div>

        <div class="alert-box">
          IMPORTANT: This is a change order for additional work beyond the original project scope
        </div>

        <div class="info-section">
          <div class="info-box">
            <h3>Change Order Information</h3>
            <p><strong>Date:</strong> ${formatDate(changeOrder.created_at)}</p>
            <p><strong>Status:</strong> <span class="status-badge status-${changeOrder.status || 'draft'}">${escapeHtml(changeOrder.status) || 'draft'}</span></p>
            <p><strong>Project:</strong> ${escapeHtml(changeOrder.project_name) || 'N/A'}</p>
            ${changeOrder.requested_date ? `<p><strong>Requested Date:</strong> ${formatDate(changeOrder.requested_date)}</p>` : ''}
            ${changeOrder.approved_date ? `<p><strong>Approved Date:</strong> ${formatDate(changeOrder.approved_date)}</p>` : ''}
          </div>
          <div class="info-box">
            <h3>Customer Information</h3>
            <p><strong>${escapeHtml(changeOrder.customer_name) || 'N/A'}</strong></p>
            ${changeOrder.customer_email ? `<p>${escapeHtml(changeOrder.customer_email)}</p>` : ''}
            ${changeOrder.customer_phone ? `<p>${escapeHtml(changeOrder.customer_phone)}</p>` : ''}
            ${changeOrder.customer_address ? `<p>${escapeHtml(changeOrder.customer_address)}</p>` : ''}
          </div>
        </div>

        <div class="change-details">
          <h3>${escapeHtml(changeOrder.title) || 'Untitled Change Order'}</h3>
          ${changeOrder.description ? `<p>${escapeHtml(changeOrder.description)}</p>` : ''}
        </div>

        ${changeOrder.reason || changeOrder.justification ? `
          <div class="reason-section">
            ${changeOrder.reason ? `
              <h4>Reason for Change</h4>
              <p>${escapeHtml(changeOrder.reason)}</p>
            ` : ''}
            ${changeOrder.justification ? `
              <h4>Justification</h4>
              <p>${escapeHtml(changeOrder.justification)}</p>
            ` : ''}
          </div>
        ` : ''}

        <h3 style="color: #f59e0b; margin-bottom: 15px;">Change Order Items</h3>
        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>${formatCurrency(changeOrder.subtotal)}</span>
          </div>
          <div class="total-row">
            <span>Tax (${parseFloat(changeOrder.tax_rate).toFixed(1)}%):</span>
            <span>${formatCurrency(changeOrder.tax_amount)}</span>
          </div>
          <div class="total-row final">
            <span>Total Change Order Amount:</span>
            <span>${formatCurrency(changeOrder.total_amount)}</span>
          </div>
        </div>

        ${changeOrder.notes ? `
          <div class="notes-section">
            <h3>Additional Notes</h3>
            <p>${escapeHtml(changeOrder.notes)}</p>
          </div>
        ` : ''}

        <div class="footer">
          <p>This change order represents additional work beyond the original project scope and will affect the project timeline and total cost.</p>
          <p>&copy; ${new Date().getFullYear()} ${escapeHtml(companyProfile.company_name)}. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }

  static async savePDFToFile(pdfBuffer, filename) {
    try {
      const uploadsDir = path.join(__dirname, '..', 'uploads', 'pdfs');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, pdfBuffer);
      
      return filePath;
    } catch (error) {
      console.error('Error saving PDF to file:', error);
      throw new Error('Failed to save PDF to file');
    }
  }
}

module.exports = PDFService; 