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

// Database connection
const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Connected to PostgreSQL database');
    release();
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.NODE_ENV === 'production' ? ['your-production-domain.com'] : ['http://localhost:3000'],
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
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.'
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Make pool available to routes
app.locals.db = pool;

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/users', require('./routes/users'));

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

const PORT = config.PORT;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
}); 