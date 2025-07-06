const { Pool } = require('pg');

// Try to load config.js, fall back to config.example.js
let config;
try {
  config = require('../config.js');
} catch (error) {
  console.log('config.js not found, using example config');
  config = require('../config.example.js');
}

const pool = new Pool({
  connectionString: config.DATABASE_URL || process.env.DATABASE_URL,
  ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createRfiTable() {
  const client = await pool.connect();
  
  try {
    console.log('Creating RFI table...');
    
    // Create RFI table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rfis (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        sent_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
        response_needed_by TIMESTAMP WITH TIME ZONE,
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'responded', 'closed', 'failed')),
        sent_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rfis_project_id ON rfis(project_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rfis_customer_id ON rfis(customer_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rfis_contact_id ON rfis(contact_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rfis_sent_by ON rfis(sent_by)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rfis_status ON rfis(status)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rfis_created_at ON rfis(created_at)
    `);
    
    console.log('RFI table created successfully!');
    
  } catch (error) {
    console.error('Error creating RFI table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the function if this script is called directly
if (require.main === module) {
  createRfiTable()
    .then(() => {
      console.log('RFI table setup completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to setup RFI table:', error);
      process.exit(1);
    });
}

module.exports = createRfiTable; 