const jwt = require('jsonwebtoken');

// Try to load config.js, fall back to config.example.js
let config;
try {
  config = require('../config.js');
} catch (error) {
  config = require('../config.example.js');
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, config.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    // Get user from database to ensure role is current
    const result = await req.app.locals.db.query(
      'SELECT role, is_active FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Error in requireAdmin middleware:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Middleware to check if user is active
const requireActive = async (req, res, next) => {
  try {
    const result = await req.app.locals.db.query(
      'SELECT is_active FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!result.rows[0].is_active) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    next();
  } catch (error) {
    console.error('Error in requireActive middleware:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireActive
}; 