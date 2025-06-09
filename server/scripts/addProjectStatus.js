const { Pool } = require('pg');
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

async function addProjectStatus() {
  try {
    console.log('Adding status column to projects table...');
    
    // Check if status column already exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'status'
    `);
    
    if (columnCheck.rows.length === 0) {
      // Add status column with default value
      await pool.query(`
        ALTER TABLE projects 
        ADD COLUMN status VARCHAR(20) DEFAULT 'started' 
        CHECK (status IN ('started', 'active', 'done'))
      `);
      console.log('Status column added successfully');
      
      // Update any existing projects to have 'active' status
      await pool.query(`UPDATE projects SET status = 'active' WHERE status IS NULL`);
      console.log('Updated existing projects with default status');
    } else {
      console.log('Status column already exists');
    }
    
    // Add some sample projects if none exist
    const existingProjects = await pool.query('SELECT id FROM projects LIMIT 1');
    
    if (existingProjects.rows.length === 0) {
      // Get the admin user ID
      const adminUser = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
      const adminId = adminUser.rows[0]?.id;
      
      if (adminId) {
        // Insert sample projects
        await pool.query(`
          INSERT INTO projects (name, description, status, created_by) VALUES
          ('Website Redesign', 'Complete overhaul of company website with modern design', 'active', $1),
          ('Mobile App Development', 'Native iOS and Android app for customer portal', 'started', $1),
          ('Database Migration', 'Migrate legacy database to new cloud infrastructure', 'done', $1)
        `, [adminId]);
        
        console.log('Sample projects created successfully');
      }
    } else {
      console.log('Projects already exist, skipping sample data creation');
    }
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Error in migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addProjectStatus(); 