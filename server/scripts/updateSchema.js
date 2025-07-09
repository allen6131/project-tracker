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

// Create estimates table
const createEstimatesTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS estimates (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      customer_id INTEGER REFERENCES customers(id),
      customer_name VARCHAR(255),
      customer_email VARCHAR(255),
      customer_phone VARCHAR(50),
      customer_address TEXT,
      status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'expired')),
      subtotal DECIMAL(10,2) DEFAULT 0.00,
      tax_rate DECIMAL(5,2) DEFAULT 0.00,
      tax_amount DECIMAL(10,2) DEFAULT 0.00,
      total_amount DECIMAL(10,2) DEFAULT 0.00,
      valid_until DATE,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log('estimates table created successfully (if it did not exist).');
  } catch (error) {
    console.error('Error creating estimates table:', error);
  }
};

// Create estimate_items table
const createEstimateItemsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS estimate_items (
      id SERIAL PRIMARY KEY,
      estimate_id INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity DECIMAL(10,2) DEFAULT 1.00,
      unit_price DECIMAL(10,2) DEFAULT 0.00,
      total_price DECIMAL(10,2) DEFAULT 0.00,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log('estimate_items table created successfully (if it did not exist).');
  } catch (error) {
    console.error('Error creating estimate_items table:', error);
  }
};

// Create invoices table
const createInvoicesTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number VARCHAR(100) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      customer_id INTEGER REFERENCES customers(id),
      customer_name VARCHAR(255),
      customer_email VARCHAR(255),
      customer_phone VARCHAR(50),
      customer_address TEXT,
      estimate_id INTEGER REFERENCES estimates(id),
      project_id INTEGER REFERENCES projects(id),
      status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
      subtotal DECIMAL(10,2) DEFAULT 0.00,
      tax_rate DECIMAL(5,2) DEFAULT 0.00,
      tax_amount DECIMAL(10,2) DEFAULT 0.00,
      total_amount DECIMAL(10,2) DEFAULT 0.00,
      due_date DATE,
      paid_date DATE,
      payment_intent_id VARCHAR(255),
      payment_method VARCHAR(50),
      payment_status VARCHAR(50),
      stripe_session_id VARCHAR(255),
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log('invoices table created successfully (if it did not exist).');
  } catch (error) {
    console.error('Error creating invoices table:', error);
  }
};

// Add payment fields to existing invoices table
const addPaymentFieldsToInvoices = async () => {
  const fields = [
    'payment_intent_id VARCHAR(255)',
    'payment_method VARCHAR(50)',
    'payment_status VARCHAR(50)',
    'stripe_session_id VARCHAR(255)'
  ];

  for (const field of fields) {
    const columnName = field.split(' ')[0];
    try {
      await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ${field};`);
      console.log(`Added ${columnName} column to invoices table (if it did not exist).`);
    } catch (error) {
      console.error(`Error adding ${columnName} column to invoices table:`, error);
    }
  }
};

// Create invoice_items table
const createInvoiceItemsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity DECIMAL(10,2) DEFAULT 1.00,
      unit_price DECIMAL(10,2) DEFAULT 0.00,
      total_price DECIMAL(10,2) DEFAULT 0.00,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log('invoice_items table created successfully (if it did not exist).');
  } catch (error) {
    console.error('Error creating invoice_items table:', error);
  }
};

// Create password_reset_tokens table
const createPasswordResetTokensTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    );
  `;

  try {
    await pool.query(query);
    console.log('password_reset_tokens table created successfully (if it did not exist).');
  } catch (error) {
    console.error('Error creating password_reset_tokens table:', error);
  }
};

// Create project_folders table
const createProjectFoldersTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS project_folders (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      is_default BOOLEAN DEFAULT false,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_id, name)
    );
  `;

  try {
    await pool.query(query);
    console.log('project_folders table created successfully (if it did not exist).');
  } catch (error) {
    console.error('Error creating project_folders table:', error);
  }
};

// Add folder_id column to project_files table
const addFolderIdToProjectFiles = async () => {
  try {
    // Check if the column already exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='project_files' AND column_name='folder_id';
    `);
    
    if (checkColumn.rows.length === 0) {
      await pool.query(`
        ALTER TABLE project_files 
        ADD COLUMN folder_id INTEGER REFERENCES project_folders(id) ON DELETE SET NULL;
      `);
      console.log('folder_id column added to project_files table successfully.');
    } else {
      console.log('folder_id column already exists in project_files table.');
    }
  } catch (error) {
    console.error('Error adding folder_id column:', error);
  }
};

// Create default folders for existing projects
const createDefaultFoldersForProjects = async () => {
  const defaultFolders = ['Bidding', 'Plans and Drawings', 'Plan Review', 'Field Markups'];
  
  try {
    // Get all existing projects
    const projects = await pool.query('SELECT id FROM projects');
    
    for (const project of projects.rows) {
      // Check if default folders already exist for this project
      const existingFolders = await pool.query(
        'SELECT name FROM project_folders WHERE project_id = $1 AND is_default = true',
        [project.id]
      );
      
      const existingFolderNames = existingFolders.rows.map(folder => folder.name);
      
      // Create missing default folders
      for (const folderName of defaultFolders) {
        if (!existingFolderNames.includes(folderName)) {
          await pool.query(
            'INSERT INTO project_folders (project_id, name, is_default) VALUES ($1, $2, true)',
            [project.id, folderName]
          );
        }
      }
    }
    
    console.log('Default folders created for existing projects.');
  } catch (error) {
    console.error('Error creating default folders for projects:', error);
  }
};

// Add main_technician_id column to projects table
const addMainTechnicianToProjects = async () => {
  try {
    // Check if the column already exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='projects' AND column_name='main_technician_id';
    `);
    
    if (checkColumn.rows.length === 0) {
      await pool.query(`
        ALTER TABLE projects 
        ADD COLUMN main_technician_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      `);
      console.log('main_technician_id column added to projects table successfully.');
    } else {
      console.log('main_technician_id column already exists in projects table.');
    }
  } catch (error) {
    console.error('Error adding main_technician_id column:', error);
  }
};

// Create project_materials table
const createProjectMaterialsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS project_materials (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity DECIMAL(10,2) DEFAULT 1.00,
      unit_cost DECIMAL(10,2) DEFAULT 0.00,
      total_cost DECIMAL(10,2) DEFAULT 0.00,
      supplier VARCHAR(255),
      purchase_date DATE,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log('project_materials table created successfully (if it did not exist).');
  } catch (error) {
    console.error('Error creating project_materials table:', error);
  }
};

// Create material_receipts table
const createMaterialReceiptsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS material_receipts (
      id SERIAL PRIMARY KEY,
      material_id INTEGER NOT NULL REFERENCES project_materials(id) ON DELETE CASCADE,
      original_name VARCHAR(255) NOT NULL,
      stored_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      file_type VARCHAR(100),
      file_size INTEGER,
      uploaded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log('material_receipts table created successfully (if it did not exist).');
  } catch (error) {
    console.error('Error creating material_receipts table:', error);
  }
};

// Create global_materials_catalog table
const createGlobalMaterialsCatalogTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS global_materials_catalog (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      unit VARCHAR(50) DEFAULT 'each',
      standard_cost DECIMAL(10,2) DEFAULT 0.00,
      supplier VARCHAR(255),
      part_number VARCHAR(100),
      notes TEXT,
      is_active BOOLEAN DEFAULT true,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(query);
    console.log('global_materials_catalog table created successfully (if it did not exist).');
  } catch (error) {
    console.error('Error creating global_materials_catalog table:', error);
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
  await createEstimatesTable();
  await createEstimateItemsTable();
  await createInvoicesTable();
  await createInvoiceItemsTable();
  await addPaymentFieldsToInvoices();
  await createPasswordResetTokensTable();
  await createProjectFoldersTable();
  await addFolderIdToProjectFiles();
  await createDefaultFoldersForProjects();
  await addMainTechnicianToProjects();
  await createProjectMaterialsTable();
  await createMaterialReceiptsTable();
  await createGlobalMaterialsCatalogTable();
  // Add other schema updates here in the future
  
  await pool.end();
};

updateDatabase(); 