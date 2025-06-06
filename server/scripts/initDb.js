const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Try to load config.js, fall back to config.example.js
let config;
try {
  config = require('../config.js');
} catch (error) {
  console.log('config.js not found, using example config. Please create config.js from config.example.js');
  config = require('../config.example.js');
}

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Users table created successfully');
    
    // Check if admin user already exists
    const existingAdmin = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      ['admin', 'admin@example.com']
    );
    
    if (existingAdmin.rows.length === 0) {
      // Create default admin user
      const adminPassword = 'admin123'; // Change this in production!
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      await pool.query(
        'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)',
        ['admin', 'admin@example.com', hashedPassword, 'admin']
      );
      
      console.log('Default admin user created:');
      console.log('Username: admin');
      console.log('Email: admin@example.com');
      console.log('Password: admin123');
      console.log('⚠️  Please change the admin password after first login!');
    } else {
      console.log('Admin user already exists, skipping creation');
    }
    
    // Create projects table (for future use)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Projects table created successfully');
    
    console.log('Database initialization completed successfully!');
    
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase(); 