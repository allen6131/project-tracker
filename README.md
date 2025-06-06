# Project Tracker

A full-stack project management application built with Node.js, Express, PostgreSQL, and React. Features user authentication, role-based access control, and admin user management.

## Features

- **User Authentication**: Secure JWT-based authentication
- **Role-Based Access**: Admin and regular user roles
- **User Management**: Admins can create, edit, and delete users
- **Modern UI**: Clean, responsive React frontend
- **Database**: PostgreSQL with Neon database support
- **Security**: Rate limiting, input validation, and secure password hashing

## Tech Stack

### Backend
- Node.js with Express.js
- PostgreSQL database (Neon compatible)
- JWT authentication
- bcryptjs for password hashing
- express-validator for input validation
- helmet for security headers
- CORS support

### Frontend
- React with TypeScript
- React Router for navigation
- Axios for API calls
- Modern CSS with responsive design

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL database (local or Neon)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd project-tracker
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Set up the database configuration**
   ```bash
   cd server
   cp config.example.js config.js
   ```
   
   Edit `server/config.js` with your database credentials:
   ```javascript
   module.exports = {
     PORT: process.env.PORT || 3001,
     DATABASE_URL: 'postgresql://username:password@host:port/database',
     JWT_SECRET: 'your-super-secret-jwt-key',
     JWT_EXPIRES_IN: '7d',
     NODE_ENV: 'development'
   };
   ```

4. **Initialize the database**
   ```bash
   npm run init-db
   ```

5. **Start the development servers**
   ```bash
   cd ..
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Default Admin Account

After running the database initialization, you can log in with:
- **Username**: admin
- **Email**: admin@example.com
- **Password**: admin123

⚠️ **Important**: Change the admin password after first login!

## Using Neon Database

To use Neon as your PostgreSQL provider:

1. Create a Neon account at https://neon.tech
2. Create a new project and database
3. Copy the connection string from your Neon dashboard
4. Update your `server/config.js` with the Neon connection string:
   ```javascript
   DATABASE_URL: 'postgresql://username:password@ep-xxx-xxx-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require'
   ```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh JWT token

### User Management (Admin only)
- `GET /api/users` - Get all users (with pagination and search)
- `POST /api/users` - Create new user
- `GET /api/users/:id` - Get specific user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Health Check
- `GET /api/health` - API health status

## Project Structure

```
project-tracker/
├── server/                 # Backend Express API
│   ├── middleware/         # Authentication middleware
│   ├── routes/            # API routes
│   ├── scripts/           # Database scripts
│   ├── config.example.js  # Configuration template
│   ├── index.js          # Server entry point
│   └── package.json      # Backend dependencies
├── client/                # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── contexts/      # React contexts
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── types/         # TypeScript types
│   │   └── App.tsx        # Main App component
│   └── package.json       # Frontend dependencies
├── package.json           # Root package.json
└── README.md             # This file
```

## Development

### Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run server` - Start only the backend server
- `npm run client` - Start only the frontend
- `npm run install-all` - Install dependencies for all packages
- `npm run build` - Build the frontend for production

### Backend Scripts

- `npm run dev` - Start server with nodemon
- `npm run start` - Start server in production mode
- `npm run init-db` - Initialize database tables and create admin user

## Security Features

- JWT token authentication
- Password hashing with bcryptjs
- Rate limiting on API endpoints
- Input validation and sanitization
- CORS configuration
- Security headers with helmet
- SQL injection prevention with parameterized queries

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support or questions, please open an issue in the repository. 