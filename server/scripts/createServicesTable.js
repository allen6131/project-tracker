const { Pool } = require('pg');

// Try to load config.js, fall back to config.example.js
let config;
try {
  config = require('../config.js');
} catch (error) {
  console.log('config.js not found, using example config');
  config = require('../config.example.js');
}

async function createServicesTable() {
  const pool = new Pool({
    connectionString: config.DATABASE_URL || process.env.DATABASE_URL,
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Creating services table...');
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        category VARCHAR(100),
        unit VARCHAR(50) NOT NULL,
        standard_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        cost DECIMAL(10,2) DEFAULT 0.00,
        notes TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(createTableQuery);
    console.log('Services table created successfully!');

    // Create indexes for better performance
    console.log('Creating indexes...');
    
    const createIndexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);',
      'CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);',
      'CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);',
      'CREATE INDEX IF NOT EXISTS idx_services_created_by ON services(created_by);'
    ];

    for (const query of createIndexQueries) {
      await pool.query(query);
    }
    
    console.log('Indexes created successfully!');

    // Insert some sample data
    console.log('Inserting sample services...');
    
    const sampleServices = [
      {
        name: 'Electrical Outlet Installation',
        description: 'Installation of standard electrical outlets',
        category: 'Installation',
        unit: 'each',
        standard_rate: 85.00,
        cost: 25.00,
        notes: 'Includes standard outlet and basic installation'
      },
      {
        name: 'Circuit Breaker Installation',
        description: 'Installation of circuit breakers in electrical panels',
        category: 'Installation',
        unit: 'each',
        standard_rate: 120.00,
        cost: 45.00,
        notes: 'Standard residential circuit breaker'
      },
      {
        name: 'Electrical Troubleshooting',
        description: 'Diagnostic and troubleshooting services',
        category: 'Maintenance',
        unit: 'hour',
        standard_rate: 95.00,
        cost: 0.00,
        notes: 'Hourly rate for electrical troubleshooting'
      },
      {
        name: 'Panel Upgrade',
        description: 'Electrical panel upgrade and modernization',
        category: 'Installation',
        unit: 'each',
        standard_rate: 1200.00,
        cost: 400.00,
        notes: 'Complete panel upgrade including permits'
      },
      {
        name: 'Lighting Fixture Installation',
        description: 'Installation of ceiling lights and fixtures',
        category: 'Installation',
        unit: 'each',
        standard_rate: 75.00,
        cost: 15.00,
        notes: 'Standard ceiling fixture installation'
      },
      {
        name: 'Emergency Service Call',
        description: 'After-hours emergency electrical services',
        category: 'Emergency Service',
        unit: 'service call',
        standard_rate: 150.00,
        cost: 0.00,
        notes: 'Emergency service call fee'
      },
      {
        name: 'Electrical Safety Inspection',
        description: 'Comprehensive electrical safety inspection',
        category: 'Inspection',
        unit: 'each',
        standard_rate: 200.00,
        cost: 0.00,
        notes: 'Complete electrical system inspection'
      },
      {
        name: 'Wiring Installation',
        description: 'New electrical wiring installation',
        category: 'Installation',
        unit: 'linear ft',
        standard_rate: 8.50,
        cost: 2.50,
        notes: 'Per linear foot of wiring'
      }
    ];

    const insertQuery = `
      INSERT INTO services (name, description, category, unit, standard_rate, cost, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT id FROM users WHERE role = 'admin' LIMIT 1))
      ON CONFLICT (name) DO NOTHING
    `;

    for (const service of sampleServices) {
      await pool.query(insertQuery, [
        service.name,
        service.description,
        service.category,
        service.unit,
        service.standard_rate,
        service.cost,
        service.notes
      ]);
    }

    console.log('Sample services inserted successfully!');
    
  } catch (error) {
    console.error('Error creating services table:', error);
  } finally {
    await pool.end();
  }
}

// Run the function
createServicesTable().catch(console.error); 