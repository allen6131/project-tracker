const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const EmailService = require('../services/emailService');

// Try to load config.js, fall back to config.example.js
let config;
try {
  config = require('../config.js');
} catch (error) {
  config = require('../config.example.js');
}

const router = express.Router();

// Handle preflight requests
router.options('*', (req, res) => {
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.sendStatus(200);
});

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
    console.log('Login attempt:', { 
      username: req.body.username, 
      origin: req.headers.origin,
      timestamp: new Date().toISOString() 
    });
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
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

// POST /api/auth/forgot-password
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    // Find user by email
    const result = await req.app.locals.db.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    // Always return success message for security (don't reveal if email exists)
    if (result.rows.length === 0) {
      return res.json({ 
        message: 'If an account with that email exists, we have sent a password reset link.' 
      });
    }

    const user = result.rows[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Store reset token in database
    await req.app.locals.db.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) 
       DO UPDATE SET token = $2, expires_at = $3, created_at = CURRENT_TIMESTAMP`,
      [user.id, resetToken, resetTokenExpiry]
    );

    // Send password reset email if service is available
    if (EmailService.isAvailable()) {
      try {
        const emailResult = await EmailService.sendPasswordResetEmail(user, resetToken);
        if (emailResult.success) {
          console.log(`Password reset email sent to ${email}`);
        } else {
          console.warn('Password reset email service not configured');
        }
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Don't fail the request if email fails, just log it
      }
    } else {
      console.warn('Email service not available - password reset email not sent');
    }

    res.json({ 
      message: 'If an account with that email exists, we have sent a password reset link.' 
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { token, password } = req.body;

    // Find valid reset token
    const tokenResult = await req.app.locals.db.query(
      `SELECT prt.*, u.id as user_id, u.email, u.username 
       FROM password_reset_tokens prt 
       JOIN users u ON prt.user_id = u.id 
       WHERE prt.token = $1 AND prt.expires_at > CURRENT_TIMESTAMP AND u.is_active = true`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ 
        message: 'Invalid or expired reset token' 
      });
    }

    const tokenData = tokenResult.rows[0];

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update user password
    await req.app.locals.db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, tokenData.user_id]
    );

    // Delete used reset token
    await req.app.locals.db.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [tokenData.user_id]
    );

    res.json({ 
      message: 'Password has been reset successfully. You can now log in with your new password.' 
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router; 