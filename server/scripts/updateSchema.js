const { Pool } = require('pg');
require('dotenv').config();

// Try to load config.js, fall back to config.example.js
let config;
try {
  config = require('../config.js');
} catch (error) {
  config = require('../config.example.js');
}

const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

const createProjectFilesTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS project_files (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      original_name VARCHAR(255) NOT NULL,
      stored_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      file_type VARCHAR(100),
      file_size INTEGER,
      is_public BOOLEAN DEFAULT true,
      uploaded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log('project_files table created successfully (if it did not exist).');
  } catch (error) {
    console.error('Error creating project_files table:', error);
  }
};

const createTodoTables = async () => {
  const listQuery = `
    CREATE TABLE IF NOT EXISTS todo_lists (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `;
  const itemQuery = `
    CREATE TABLE IF NOT EXISTS todo_items (
      id SERIAL PRIMARY KEY,
      todo_list_id INTEGER NOT NULL REFERENCES todo_lists(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_completed BOOLEAN NOT NULL DEFAULT false,
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      due_date DATE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(listQuery);
    console.log('todo_lists table created successfully (if it did not exist).');
    await pool.query(itemQuery);
    console.log('todo_items table created successfully (if it did not exist).');
  } catch (error) {
    console.error('Error creating todo tables:', error);
  }
};

// Add assigned_to column to existing todo_items table
const addAssignedToColumn = async () => {
  try {
    // Check if the column already exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='todo_items' AND column_name='assigned_to';
    `);
    
    if (checkColumn.rows.length === 0) {
      await pool.query(`
        ALTER TABLE todo_items 
        ADD COLUMN assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL;
      `);
      console.log('assigned_to column added to todo_items table successfully.');
    } else {
      console.log('assigned_to column already exists in todo_items table.');
    }
  } catch (error) {
    console.error('Error adding assigned_to column:', error);
  }
};

// Add due_date column to existing todo_items table
const addDueDateColumn = async () => {
  try {
    // Check if the column already exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='todo_items' AND column_name='due_date';
    `);
    
    if (checkColumn.rows.length === 0) {
      await pool.query(`
        ALTER TABLE todo_items 
        ADD COLUMN due_date DATE;
      `);
      console.log('due_date column added to todo_items table successfully.');
    } else {
      console.log('due_date column already exists in todo_items table.');
    }
  } catch (error) {
    console.error('Error adding due_date column:', error);
  }
};

// Create customers table
const createCustomersTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      industry VARCHAR(100),
      website VARCHAR(255),
      phone VARCHAR(50),
      email VARCHAR(255),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      country VARCHAR(100),
      postal_code VARCHAR(20),
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log('customers table created successfully (if it did not exist).');
  } catch (error) {
    console.error('Error creating customers table:', error);
  }
};

// Create contacts table
const createContactsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50),
      position VARCHAR(100),
      department VARCHAR(100),
      is_primary BOOLEAN DEFAULT false,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log('contacts table created successfully (if it did not exist).');
  } catch (error) {
    console.error('Error creating contacts table:', error);
  }
};

// Add customer_id column to projects table
const addCustomerToProjects = async () => {
  try {
    // Check if the column already exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='projects' AND column_name='customer_id';
    `);
    
    if (checkColumn.rows.length === 0) {
      await pool.query(`
        ALTER TABLE projects 
        ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
      `);
      console.log('customer_id column added to projects table successfully.');
    } else {
      console.log('customer_id column already exists in projects table.');
    }
  } catch (error) {
    console.error('Error adding customer_id column:', error);
  }
};

const updateDatabase = async () => {
  await createProjectFilesTable();
  await createTodoTables();
  await addAssignedToColumn();
  await addDueDateColumn();
  await createCustomersTable();
  await createContactsTable();
  await addCustomerToProjects();
  // Add other schema updates here in the future
  
  await pool.end();
};

updateDatabase(); 