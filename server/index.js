const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
require('dotenv').config();

// Try to load config.js, fall back to config.example.js
let config;
try {
  config = require('./config.js');
} catch (error) {
  console.log('config.js not found, using example config. Please create config.js from config.example.js');
  config = require('./config.example.js');
}

const app = express();

// Database connection with proper error handling
let pool;
try {
  const databaseUrl = config.DATABASE_URL || process.env.DATABASE_URL;
  
  if (!databaseUrl || databaseUrl.includes('postgresql://username:password@localhost')) {
    console.error('DATABASE_URL not configured properly');
    console.error('Please set DATABASE_URL environment variable or create config.js file');
    process.exit(1);
  }

  pool = new Pool({
    connectionString: databaseUrl,
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Test database connection
  pool.connect((err, client, release) => {
    if (err) {
      console.error('Error connecting to the database:', err);
      console.error('Please check your DATABASE_URL configuration');
      process.exit(1);
    } else {
      console.log('Connected to PostgreSQL database');
      release();
    }
  });

} catch (error) {
  console.error('Failed to initialize database connection:', error);
  process.exit(1);
}

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.NODE_ENV === 'production' ? ['https://amptrack.vercel.app'] : ['http://localhost:3000', 'https://amptrack.vercel.app'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Stricter rate limiting for auth routes  
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: 'Too many authentication attempts, please try again later.'
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Make pool available to routes
app.locals.db = pool;

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/files', require('./routes/files'));
app.use('/api/estimates', require('./routes/estimates'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/catalog-materials', require('./routes/catalog-materials'));
app.use('/api/services', require('./routes/services'));
app.use('/api/rfi', require('./routes/rfi'));
app.use('/api/change-orders', require('./routes/change-orders'));
app.use('/api', require('./routes/todos'));

// Root landing page
app.get('/', (req, res) => {
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Server Status</title>
      <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; }
        .status-card { background-color: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); text-align: center; }
        .status-indicator { height: 20px; width: 20px; background-color: #28a745; border-radius: 50%; display: inline-block; margin-right: 10px; vertical-align: middle; }
        .status-text { font-size: 24px; color: #333; vertical-align: middle; }
      </style>
    </head>
    <body>
      <div class="status-card">
        <span class="status-indicator"></span>
        <span class="status-text">Server is up and running</span>
      </div>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: config.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = config.PORT || process.env.PORT || 6000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
  console.log(`Database configured: ${!!pool}`);
  console.log(`Email service available: ${require('./services/emailService').isAvailable()}`);
  console.log(`Payment service available: ${require('./services/stripeService').isAvailable()}`);
}); 