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
  ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const sampleCustomers = [
  {
    name: 'TechFlow Solutions',
    description: 'A leading software development company specializing in enterprise solutions and cloud infrastructure.',
    industry: 'Software Development',
    website: 'https://techflowsolutions.com',
    phone: '+1 (555) 123-4567',
    email: 'hello@techflowsolutions.com',
    address: '123 Innovation Drive',
    city: 'San Francisco',
    state: 'California',
    country: 'United States',
    postal_code: '94105',
    contacts: [
      {
        first_name: 'Sarah',
        last_name: 'Johnson',
        email: 'sarah.johnson@techflowsolutions.com',
        phone: '+1 (555) 123-4568',
        position: 'CEO',
        department: 'Executive',
        is_primary: true,
        notes: 'Primary decision maker for all technical projects'
      },
      {
        first_name: 'Michael',
        last_name: 'Chen',
        email: 'michael.chen@techflowsolutions.com',
        phone: '+1 (555) 123-4569',
        position: 'CTO',
        department: 'Technology',
        is_primary: false,
        notes: 'Technical lead and project oversight'
      }
    ]
  },
  {
    name: 'GlobalCorp Industries',
    description: 'Multinational manufacturing corporation with operations across 15 countries.',
    industry: 'Manufacturing',
    website: 'https://globalcorp.com',
    phone: '+1 (555) 987-6543',
    email: 'contact@globalcorp.com',
    address: '456 Corporate Boulevard',
    city: 'New York',
    state: 'New York',
    country: 'United States',
    postal_code: '10001',
    contacts: [
      {
        first_name: 'David',
        last_name: 'Rodriguez',
        email: 'david.rodriguez@globalcorp.com',
        phone: '+1 (555) 987-6544',
        position: 'Project Manager',
        department: 'Operations',
        is_primary: true,
        notes: 'Manages all IT infrastructure projects'
      },
      {
        first_name: 'Emily',
        last_name: 'Wilson',
        email: 'emily.wilson@globalcorp.com',
        phone: '+1 (555) 987-6545',
        position: 'VP of Technology',
        department: 'Technology',
        is_primary: false,
        notes: 'Strategic technology planning and budgets'
      }
    ]
  },
  {
    name: 'StartupHub Ventures',
    description: 'Innovative startup incubator focused on fintech and blockchain technologies.',
    industry: 'Financial Technology',
    website: 'https://startuphub.ventures',
    phone: '+1 (555) 456-7890',
    email: 'info@startuphub.ventures',
    address: '789 Startup Street',
    city: 'Austin',
    state: 'Texas',
    country: 'United States',
    postal_code: '73301',
    contacts: [
      {
        first_name: 'Alex',
        last_name: 'Thompson',
        email: 'alex.thompson@startuphub.ventures',
        phone: '+1 (555) 456-7891',
        position: 'Founder & CEO',
        department: 'Executive',
        is_primary: true,
        notes: 'Visionary leader with focus on emerging technologies'
      },
      {
        first_name: 'Jessica',
        last_name: 'Park',
        email: 'jessica.park@startuphub.ventures',
        phone: '+1 (555) 456-7892',
        position: 'Head of Product',
        department: 'Product',
        is_primary: false,
        notes: 'Product strategy and user experience design'
      }
    ]
  },
  {
    name: 'MedTech Innovations',
    description: 'Healthcare technology company developing AI-powered diagnostic tools.',
    industry: 'Healthcare Technology',
    website: 'https://medtechinnovations.com',
    phone: '+1 (555) 321-0987',
    email: 'contact@medtechinnovations.com',
    address: '321 Medical Plaza',
    city: 'Boston',
    state: 'Massachusetts',
    country: 'United States',
    postal_code: '02101',
    contacts: [
      {
        first_name: 'Dr. Lisa',
        last_name: 'Anderson',
        email: 'lisa.anderson@medtechinnovations.com',
        phone: '+1 (555) 321-0988',
        position: 'Chief Medical Officer',
        department: 'Medical',
        is_primary: true,
        notes: 'Clinical expertise and regulatory compliance oversight'
      },
      {
        first_name: 'Robert',
        last_name: 'Kim',
        email: 'robert.kim@medtechinnovations.com',
        phone: '+1 (555) 321-0989',
        position: 'Engineering Director',
        department: 'Engineering',
        is_primary: false,
        notes: 'Technical implementation and system architecture'
      }
    ]
  },
  {
    name: 'EcoFriendly Solutions',
    description: 'Sustainable technology company focused on renewable energy and environmental monitoring.',
    industry: 'Renewable Energy',
    website: 'https://ecofriendlysolutions.com',
    phone: '+1 (555) 654-3210',
    email: 'hello@ecofriendlysolutions.com',
    address: '654 Green Avenue',
    city: 'Portland',
    state: 'Oregon',
    country: 'United States',
    postal_code: '97201',
    contacts: [
      {
        first_name: 'Maria',
        last_name: 'Garcia',
        email: 'maria.garcia@ecofriendlysolutions.com',
        phone: '+1 (555) 654-3211',
        position: 'Sustainability Director',
        department: 'Operations',
        is_primary: true,
        notes: 'Environmental impact assessment and green technology initiatives'
      }
    ]
  }
];

const seedCustomers = async () => {
  try {
    console.log('Starting customer seeding...');

    // Get admin user ID (assuming admin user exists)
    const adminResult = await pool.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['admin']);
    const adminId = adminResult.rows[0]?.id;

    if (!adminId) {
      console.error('No admin user found. Please run initDb.js first to create the admin user.');
      return;
    }

    for (const customerData of sampleCustomers) {
      // Check if customer already exists
      const existingCustomer = await pool.query('SELECT id FROM customers WHERE name = $1', [customerData.name]);
      
      if (existingCustomer.rows.length > 0) {
        console.log(`Customer "${customerData.name}" already exists, skipping...`);
        continue;
      }

      // Insert customer
      const customerResult = await pool.query(
        `INSERT INTO customers 
          (name, description, industry, website, phone, email, address, city, state, country, postal_code, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
         RETURNING id`,
        [
          customerData.name,
          customerData.description,
          customerData.industry,
          customerData.website,
          customerData.phone,
          customerData.email,
          customerData.address,
          customerData.city,
          customerData.state,
          customerData.country,
          customerData.postal_code,
          adminId
        ]
      );

      const customerId = customerResult.rows[0].id;
      console.log(`Created customer: ${customerData.name} (ID: ${customerId})`);

      // Insert contacts for this customer
      for (const contactData of customerData.contacts) {
        await pool.query(
          `INSERT INTO contacts 
            (customer_id, first_name, last_name, email, phone, position, department, is_primary, notes) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            customerId,
            contactData.first_name,
            contactData.last_name,
            contactData.email,
            contactData.phone,
            contactData.position,
            contactData.department,
            contactData.is_primary,
            contactData.notes
          ]
        );

        console.log(`  Created contact: ${contactData.first_name} ${contactData.last_name}`);
      }
    }

    console.log('✅ Customer seeding completed successfully!');
    console.log('\nSeeded Customers:');
    sampleCustomers.forEach((customer, index) => {
      console.log(`${index + 1}. ${customer.name} (${customer.industry})`);
      customer.contacts.forEach(contact => {
        console.log(`   - ${contact.first_name} ${contact.last_name} (${contact.position})`);
      });
    });

  } catch (error) {
    console.error('Error seeding customers:', error);
  } finally {
    await pool.end();
  }
};

seedCustomers(); 