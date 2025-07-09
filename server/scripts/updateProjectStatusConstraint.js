const { Pool } = require('pg');

// Try to load config.js, fall back to config.example.js
let config;
try {
  config = require('../config.js');
} catch (error) {
  console.log('config.js not found, using example config. Please create config.js from config.example.js');
  config = require('../config.example.js');
}

const pool = new Pool({
  connectionString: config.DATABASE_URL || process.env.DATABASE_URL,
  ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function updateProjectStatusConstraint() {
  try {
    console.log('Updating project status constraint to include bidding...');
    
    // First, drop the existing constraint
    await pool.query(`
      ALTER TABLE projects 
      DROP CONSTRAINT IF EXISTS projects_status_check
    `);
    
    console.log('Dropped existing status constraint');
    
    // Add the new constraint that includes 'bidding'
    await pool.query(`
      ALTER TABLE projects 
      ADD CONSTRAINT projects_status_check 
      CHECK (status IN ('bidding', 'started', 'active', 'done'))
    `);
    
    console.log('Added new status constraint with bidding support');
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Error in migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
updateProjectStatusConstraint(); 