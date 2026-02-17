/**
 * Reset and Seed Script
 *
 * This script drops all collections and reseeds the database with fresh data.
 *
 * USER ROLES:
 * - ADMIN: Full system access
 * - TEAM_MEMBER: Collects samples and submits lab values
 *
 * SIMPLIFIED WORKFLOW:
 * 1. Team member collects sample (TESTING status)
 * 2. Team member submits lab values → auto-publishes (PUBLISHED status)
 * 3. Admin can archive samples (ARCHIVED)
 *
 * Usage: npm run seed:reset
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { resetAndSeed } = require('./seedParameters');

const run = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/waterquality_db';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB:', mongoUri);

    console.log('\n========================================');
    console.log('  RESETTING DATABASE AND SEEDING DATA');
    console.log('========================================\n');

    // Run the reset and seed function
    await resetAndSeed();

    process.exit(0);
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  }
};

run();
