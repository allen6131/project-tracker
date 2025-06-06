// Copy this file to config.js and update with your actual values
module.exports = {
  PORT: process.env.PORT || 6000,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/project_tracker',
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// For Neon Database, your DATABASE_URL will look like:
// postgresql://username:password@ep-xxx-xxx-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require 