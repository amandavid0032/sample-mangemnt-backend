/**
 * Check Database Script
 * Run: node utils/checkDB.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const { User, Sample, ParameterMaster } = require('../models');

const checkDB = async () => {
  try {
    await connectDB();

    console.log('\n========================================');
    console.log('  DATABASE CHECK');
    console.log('========================================\n');

    // Check Users
    const users = await User.find({}).select('name email role isActive');
    console.log(`USERS (${users.length}):`);
    users.forEach(u => {
      console.log(`  - ${u.email} | ${u.role} | Active: ${u.isActive}`);
    });

    // Check Parameters
    const params = await ParameterMaster.find({}).select('name category limitType isActive');
    console.log(`\nPARAMETERS (${params.length}):`);
    if (params.length <= 5) {
      params.forEach(p => {
        console.log(`  - ${p.name} | ${p.category} | ${p.limitType}`);
      });
    } else {
      console.log(`  First 5:`);
      params.slice(0, 5).forEach(p => {
        console.log(`  - ${p.name} | ${p.category} | ${p.limitType}`);
      });
      console.log(`  ... and ${params.length - 5} more`);
    }

    // Check Samples
    const samples = await Sample.find({}).select('sampleId locationName lifecycleStatus overallStatus');
    console.log(`\nSAMPLES (${samples.length}):`);

    // Group by lifecycle status
    const byLifecycle = {};
    const byOverall = {};

    samples.forEach(s => {
      byLifecycle[s.lifecycleStatus] = (byLifecycle[s.lifecycleStatus] || 0) + 1;
      if (s.overallStatus) {
        byOverall[s.overallStatus] = (byOverall[s.overallStatus] || 0) + 1;
      }
    });

    console.log('\n  By Lifecycle Status:');
    Object.keys(byLifecycle).forEach(status => {
      console.log(`    ${status}: ${byLifecycle[status]}`);
    });

    console.log('\n  By Overall Quality:');
    Object.keys(byOverall).forEach(status => {
      console.log(`    ${status}: ${byOverall[status]}`);
    });

    // Show sample details
    console.log('\n  Sample Details:');
    samples.forEach(s => {
      console.log(`    ${s.sampleId} | ${s.lifecycleStatus} | ${s.overallStatus || 'N/A'} | ${s.locationName}`);
    });

    console.log('\n========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

checkDB();
