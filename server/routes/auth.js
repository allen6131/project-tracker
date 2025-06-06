const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');

// Try to load config.js, fall back to config.example.js
let config;
try {
  config = require('../config.js');
} catch (error) {
  config = require('../config.example.js');
}

const router = express.Router();

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
};

// POST /api/auth/login
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').isLength({ min: 1 }).withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, password } = req.body;

    // Find user by username or email
    const result = await req.app.locals.db.query(
      'SELECT * FROM users WHERE (username = $1 OR email = $1) AND is_active = true',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user);

    // Update last login timestamp
    await req.app.locals.db.query(
      'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', authenticateToken, (req, res) => {
  // Generate new token with current user data
  const token = generateToken(req.user);
  
  res.json({
    message: 'Token refreshed successfully',
    token
  });
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await req.app.locals.db.query(
      'SELECT id, username, email, role, created_at FROM users WHERE id = $1 AND is_active = true',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  // In a more complex setup, you might want to blacklist the token
  // For now, we'll just send a success response
  res.json({ message: 'Logged out successfully' });
});

module.exports = router; 