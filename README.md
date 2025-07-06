# AmpTrack - Electrical Project Management System

A comprehensive project management system designed specifically for electrical contractors, featuring estimates, invoices, project tracking, and customer management.

## 🚀 Features

### Core Functionality
- **Project Management**: Create, track, and manage electrical projects with status workflows
- **Customer Management**: Maintain customer database with contact information
- **User Management**: Role-based access control (Admin/User)
- **File Management**: Upload and organize project files
- **Todo Lists**: Task management with assignment capabilities

### Financial Management
- **Estimates**: Create detailed estimates with line items, tax calculations, and customer details
- **Invoices**: Generate professional invoices with auto-numbering
- **Estimate-to-Project**: Convert approved estimates into projects with one click
- **Estimate-to-Invoice**: Create invoices directly from approved estimates

### Email Integration (AWS SES)
- **Estimate Emails**: Send professional estimates directly to customers via email
- **Welcome Emails**: Automated welcome emails for new users
- **Password Reset**: Secure password reset functionality via email
- **Professional Templates**: Branded HTML email templates

### Status Workflows
- **Estimates**: Draft → Sent → Approved/Rejected → Expired
- **Invoices**: Draft → Sent → Paid/Overdue → Cancelled
- **Projects**: Started → Active → Done

## 🛠 Tech Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** database
- **JWT** authentication
- **AWS SES** for email services
- **Multer** for file uploads
- **bcryptjs** for password hashing

### Frontend
- **React** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API calls
- **Context API** for state management

## 📋 Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- AWS account (for email functionality)

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone <repository-url>
cd project-tracker
```

### 2. Backend Setup
```bash
cd server
npm install

# Copy and configure environment
cp config.example.js config.js
# Edit config.js with your database and AWS credentials

# Initialize database
node scripts/initDb.js
node scripts/updateSchema.js
```

### 3. Frontend Setup
```bash
cd client
npm install
npm start
```

### 4. Access Application
- Frontend: http://localhost:3000
- Backend: http://localhost:6000

### 5. Default Login
- Username: `admin`
- Password: `admin123`
- **⚠️ Change password immediately after first login!**

## 📧 Email Setup (AWS SES)

The application includes comprehensive email functionality. See [AWS_SES_SETUP.md](server/AWS_SES_SETUP.md) for detailed configuration instructions.

### Quick Email Setup
1. Create AWS account and set up SES
2. Verify your domain or email address
3. Create IAM user with SES permissions
4. Update configuration:

```javascript
// config.js
module.exports = {
  // ... other config
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'your-access-key',
  AWS_SECRET_ACCESS_KEY: 'your-secret-key',
  FROM_EMAIL: 'noreply@yourdomain.com',
  CLIENT_URL: 'https://yourdomain.com',
};
```

## 📊 Database Schema

### Core Tables
- `users` - User accounts and authentication
- `customers` - Customer information and contacts
- `projects` - Project management with status tracking
- `estimates` - Financial estimates with line items
- `invoices` - Invoice generation and tracking
- `todo_lists` & `todo_items` - Task management
- `project_files` - File attachments
- `password_reset_tokens` - Secure password reset

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Role-Based Access**: Admin and User roles with different permissions
- **Active User Management**: Ability to deactivate users
- **Secure Password Reset**: Time-limited tokens for password reset
- **CORS Protection**: Configured for specific domains

## 📱 User Interface

### Dashboard Features
- **Tabbed Navigation**: Projects, Estimates, Invoices, Customers, Users
- **Quick Actions**: Status updates, email sending, project creation
- **Search & Filter**: Find projects/estimates/invoices quickly
- **Pagination**: Handle large datasets efficiently
- **Responsive Design**: Works on desktop, tablet, and mobile

### Workflow Examples

#### Estimate → Project → Invoice Flow
1. Create estimate with customer details and line items
2. Send estimate via email to customer
3. Customer approves → Update status to "approved"
4. Convert estimate to project with one click
5. Create invoice from estimate or manually
6. Track invoice payment status

## 🚀 Deployment

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=7d

# AWS SES
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
FROM_EMAIL=noreply@yourdomain.com

# URLs
CLIENT_URL=https://yourdomain.com
PORT=6000
NODE_ENV=production
```

### Production Checklist
- [ ] Set up production database
- [ ] Configure AWS SES with verified domain
- [ ] Update JWT secret
- [ ] Set up HTTPS
- [ ] Configure CORS for production domain
- [ ] Set up monitoring and logging
- [ ] Backup strategy for database

## 🧪 Testing

### Backend Tests
```bash
cd server
npm test
```

### Frontend Tests
```bash
cd client
npm test
```

## 📄 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/auth/me` - Get current user

### Estimates Endpoints
- `GET /api/estimates` - List estimates
- `POST /api/estimates` - Create estimate
- `PUT /api/estimates/:id` - Update estimate
- `DELETE /api/estimates/:id` - Delete estimate
- `POST /api/estimates/:id/send-email` - Send estimate via email
- `POST /api/estimates/:id/create-project` - Convert to project

### Similar patterns for:
- `/api/invoices` - Invoice management
- `/api/projects` - Project management
- `/api/customers` - Customer management
- `/api/users` - User management

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📞 Support

For issues and questions:
1. Check the troubleshooting section in AWS_SES_SETUP.md
2. Review server logs for detailed error messages
3. Ensure all configuration values are correct
4. Test with verified email addresses first

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with Create React App
- Uses Tailwind CSS for styling
- Email templates inspired by modern transactional email design
- Icons and UI components following modern design principles 