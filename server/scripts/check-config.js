#!/usr/bin/env node

// Configuration check script for deployment debugging
const path = require('path');
require('dotenv').config();

console.log('🔧 AmpTrack Backend Configuration Check\n');

// Try to load config
let config;
try {
  config = require('../config.js');
  console.log('✅ config.js file found');
} catch (error) {
  console.log('⚠️  config.js not found, checking config.example.js');
  try {
    config = require('../config.example.js');
    console.log('✅ config.example.js loaded as fallback');
  } catch (err) {
    console.log('❌ Neither config.js nor config.example.js found');
    process.exit(1);
  }
}

console.log('\n📊 Configuration Status:\n');

// Check database configuration
const databaseUrl = config.DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log('❌ DATABASE_URL: Not configured');
} else if (databaseUrl.includes('username:password@localhost')) {
  console.log('⚠️  DATABASE_URL: Using example/placeholder values');
} else {
  console.log('✅ DATABASE_URL: Configured');
}

// Check JWT configuration
const jwtSecret = config.JWT_SECRET || process.env.JWT_SECRET;
if (!jwtSecret) {
  console.log('❌ JWT_SECRET: Not configured');
} else if (jwtSecret.includes('your-super-secret')) {
  console.log('⚠️  JWT_SECRET: Using example/placeholder values');
} else {
  console.log('✅ JWT_SECRET: Configured');
}

// Check AWS SES configuration
const awsAccessKey = config.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const awsSecretKey = config.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
if (!awsAccessKey || !awsSecretKey) {
  console.log('⚠️  AWS SES: Not configured (email features will be disabled)');
} else if (awsAccessKey.includes('your-aws-access-key') || awsSecretKey.includes('your-aws-secret-access-key')) {
  console.log('⚠️  AWS SES: Using example/placeholder values');
} else {
  console.log('✅ AWS SES: Configured');
}

// Check Stripe configuration
const stripeSecret = config.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
const stripePublic = config.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY;
if (!stripeSecret || !stripePublic) {
  console.log('⚠️  Stripe: Not configured (payment features will be disabled)');
} else if (stripeSecret.includes('your_stripe_secret_key') || stripePublic.includes('your_stripe_publishable_key')) {
  console.log('⚠️  Stripe: Using example/placeholder values');
} else {
  console.log('✅ Stripe: Configured');
}

// Check environment
const nodeEnv = config.NODE_ENV || process.env.NODE_ENV || 'development';
console.log(`📍 Environment: ${nodeEnv}`);

// Check port
const port = config.PORT || process.env.PORT || 6000;
console.log(`🔌 Port: ${port}`);

console.log('\n🎯 Deployment Readiness:');

const criticalIssues = [];
const warnings = [];

if (!databaseUrl || databaseUrl.includes('username:password@localhost')) {
  criticalIssues.push('DATABASE_URL not properly configured');
}

if (!jwtSecret || jwtSecret.includes('your-super-secret')) {
  criticalIssues.push('JWT_SECRET not properly configured');
}

if (!awsAccessKey || !awsSecretKey || awsAccessKey.includes('your-aws-access-key')) {
  warnings.push('Email service will be disabled');
}

if (!stripeSecret || !stripePublic || stripeSecret.includes('your_stripe_secret_key')) {
  warnings.push('Payment service will be disabled');
}

if (criticalIssues.length > 0) {
  console.log('\n❌ Critical Issues (will cause deployment failures):');
  criticalIssues.forEach(issue => console.log(`   • ${issue}`));
}

if (warnings.length > 0) {
  console.log('\n⚠️  Warnings (features will be disabled):');
  warnings.forEach(warning => console.log(`   • ${warning}`));
}

if (criticalIssues.length === 0 && warnings.length === 0) {
  console.log('\n✅ All configurations look good for deployment!');
} else if (criticalIssues.length === 0) {
  console.log('\n✅ Ready for deployment (with some features disabled)');
} else {
  console.log('\n❌ Not ready for deployment - fix critical issues first');
  process.exit(1);
}

console.log('\n📚 For more information, see:');
console.log('   • README.md for setup instructions');
console.log('   • AWS_SES_SETUP.md for email configuration');
console.log('   • STRIPE_SETUP.md for payment configuration'); 