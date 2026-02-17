/**
 * Seed Parameters and Users for Water Quality System
 * Based on IS 10500:2012 Indian Standard for Drinking Water
 *
 * USER ROLES:
 * - ADMIN: Full system access
 * - TEAM_MEMBER: Field collection + Lab analysis
 *
 * SIMPLIFIED WORKFLOW:
 * TESTING → PUBLISHED → ARCHIVED
 */

const { ParameterMaster, User, Sample } = require('../models');

// IS 10500:2012 Parameters (12 parameters as per documentation)
const parameters = [
  // 1. Temperature - TEXT (free text)
  {
    code: 'TEMPERATURE',
    name: 'Temperature',
    unit: '-',
    type: 'TEXT',
    acceptableLimit: { min: null, max: null },
    permissibleLimit: { min: null, max: null },
    testMethod: '-',
    isActive: true
  },
  // 2. pH - RANGE (6.5 to 8.5)
  {
    code: 'PH',
    name: 'pH',
    unit: '-',
    type: 'RANGE',
    acceptableLimit: { min: 6.5, max: 8.5 },
    permissibleLimit: { min: 6.5, max: 8.5 },
    testMethod: 'IS 3025 Part 11',
    isActive: true
  },
  // 3. Apparent Colour - ENUM (dropdown)
  {
    code: 'APPARENT_COLOUR',
    name: 'Apparent Colour',
    unit: '-',
    type: 'ENUM',
    enumValues: ['Clear', 'Yellowish', 'Brownish', 'Blackish'],
    acceptableLimit: { min: null, max: null },
    permissibleLimit: { min: null, max: null },
    testMethod: '-',
    isActive: true
  },
  // 4. True Colour - MAX (5 Hazen)
  {
    code: 'TRUE_COLOUR',
    name: 'True Colour',
    unit: 'Hazen',
    type: 'MAX',
    acceptableLimit: { min: null, max: 5 },
    permissibleLimit: { min: null, max: 15 },
    testMethod: 'IS 3025 (Part 4)',
    isActive: true
  },
  // 5. Odour - ENUM (dropdown)
  {
    code: 'ODOUR',
    name: 'Odour',
    unit: '-',
    type: 'ENUM',
    enumValues: ['Unobjectionable', 'Earthy', 'Sewer smell'],
    acceptableLimit: { min: null, max: null },
    permissibleLimit: { min: null, max: null },
    testMethod: 'IS 3025 (Part 5)',
    isActive: true
  },
  // 6. Turbidity - MAX (1 NTU)
  {
    code: 'TURBIDITY',
    name: 'Turbidity',
    unit: 'NTU',
    type: 'MAX',
    acceptableLimit: { min: null, max: 1 },
    permissibleLimit: { min: null, max: 5 },
    testMethod: 'IS 3025 (Part 10)',
    isActive: true
  },
  // 7. Total Dissolved Solids - MAX (500 mg/L)
  {
    code: 'TDS',
    name: 'Total Dissolved Solids',
    unit: 'mg/L',
    type: 'MAX',
    acceptableLimit: { min: null, max: 500 },
    permissibleLimit: { min: null, max: 2000 },
    testMethod: 'IS 3025 (Part 16)',
    isActive: true
  },
  // 8. Aluminum - MAX (0.03 mg/L)
  {
    code: 'ALUMINUM',
    name: 'Aluminum (as Al)',
    unit: 'mg/L',
    type: 'MAX',
    acceptableLimit: { min: null, max: 0.03 },
    permissibleLimit: { min: null, max: 0.2 },
    testMethod: 'IS 3025 (Part 55)',
    isActive: true
  },
  // 9. Ammonia - MAX (0.5 mg/L)
  {
    code: 'AMMONIA',
    name: 'Ammonia (as Total Ammonia-N)',
    unit: 'mg/L',
    type: 'MAX',
    acceptableLimit: { min: null, max: 0.5 },
    permissibleLimit: { min: null, max: 0.5 },
    testMethod: 'IS 3025 (Part 34)',
    isActive: true
  },
  // 10. Chloride - MAX (250 mg/L)
  {
    code: 'CHLORIDE',
    name: 'Chloride (as Cl)',
    unit: 'mg/L',
    type: 'MAX',
    acceptableLimit: { min: null, max: 250 },
    permissibleLimit: { min: null, max: 1000 },
    testMethod: 'IS 3025 (Part 32)',
    isActive: true
  },
  // 11. Free Residual Chlorine - MAX (0.2 mg/L)
  {
    code: 'FREE_CHLORINE',
    name: 'Free Residual Chlorine',
    unit: 'mg/L',
    type: 'MAX',
    acceptableLimit: { min: null, max: 0.2 },
    permissibleLimit: { min: null, max: 1.0 },
    testMethod: 'IS 3024 (Part 26)',
    isActive: true
  },
  // 12. Total Hardness - MAX (200 mg/L)
  {
    code: 'HARDNESS',
    name: 'Total Hardness (as CaCO3)',
    unit: 'mg/L',
    type: 'MAX',
    acceptableLimit: { min: null, max: 200 },
    permissibleLimit: { min: null, max: 600 },
    testMethod: 'IS 3024 (Part 21)',
    isActive: true
  }
];

// Seed Parameters
const seedParameters = async () => {
  try {
    for (const param of parameters) {
      const exists = await ParameterMaster.findOne({ code: param.code });
      if (!exists) {
        await ParameterMaster.create(param);
        console.log(`  Created parameter: ${param.code}`);
      }
    }
    console.log(`Parameters seeded: ${parameters.length} parameters`);
  } catch (error) {
    console.error('Error seeding parameters:', error.message);
  }
};

// Seed Admin User
const seedAdmin = async () => {
  try {
    const exists = await User.findOne({ email: 'admin@waterquality.com' });
    if (!exists) {
      await User.create({
        name: 'Admin User',
        email: 'admin@waterquality.com',
        password: 'admin123',
        role: 'ADMIN',
        isActive: true
      });
      console.log('  Created ADMIN: admin@waterquality.com');
    }
  } catch (error) {
    console.error('Error seeding admin:', error.message);
  }
};

// Seed Team Member User
const seedTeamMember = async () => {
  try {
    const exists = await User.findOne({ email: 'team@waterquality.com' });
    if (!exists) {
      await User.create({
        name: 'Rahul Sharma',
        email: 'team@waterquality.com',
        password: 'team123',
        role: 'TEAM_MEMBER',
        isActive: true
      });
      console.log('  Created TEAM_MEMBER: team@waterquality.com');
    }
  } catch (error) {
    console.error('Error seeding team member:', error.message);
  }
};

// Seed Sample Data for Testing (simplified workflow)
const seedSampleData = async () => {
  try {
    const existingSamples = await Sample.countDocuments();
    if (existingSamples > 0) {
      console.log(`  Samples already exist: ${existingSamples} samples`);
      return;
    }

    const teamMember = await User.findOne({ role: 'TEAM_MEMBER' });
    const admin = await User.findOne({ role: 'ADMIN' });

    if (!teamMember || !admin) {
      console.log('  Users not found, skipping sample seeding');
      return;
    }

    const allParams = await ParameterMaster.find({ isActive: true });
    if (allParams.length === 0) {
      console.log('  Parameters not found, skipping sample seeding');
      return;
    }

    // Sample locations in India
    const locations = [
      { address: 'Yamuna River Bank, New Delhi', lat: 28.6139, lng: 77.2090 },
      { address: 'Gomti Nagar, Lucknow, UP', lat: 26.8467, lng: 80.9462 },
      { address: 'Marine Drive, Mumbai, Maharashtra', lat: 18.9442, lng: 72.8234 },
      { address: 'Salt Lake, Kolkata, West Bengal', lat: 22.5726, lng: 88.3639 },
      { address: 'Koramangala, Bangalore, Karnataka', lat: 12.9352, lng: 77.6245 },
      { address: 'T Nagar, Chennai, Tamil Nadu', lat: 13.0418, lng: 80.2341 },
      { address: 'Banjara Hills, Hyderabad, Telangana', lat: 17.4156, lng: 78.4347 },
      { address: 'Vastrapur, Ahmedabad, Gujarat', lat: 23.0300, lng: 72.5300 },
      { address: 'Model Town, Jalandhar, Punjab', lat: 31.3260, lng: 75.5762 },
      { address: 'Civil Lines, Jaipur, Rajasthan', lat: 26.9124, lng: 75.7873 }
    ];

    const samples = [];
    const now = new Date();

    // Create samples: 5 TESTING, 5 PUBLISHED
    for (let i = 0; i < 10; i++) {
      const loc = locations[i];
      const daysAgo = 10 - i;
      const collectedAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      const sample = {
        address: loc.address,
        location: {
          type: 'Point',
          coordinates: [loc.lng, loc.lat]
        },
        collectedBy: teamMember._id,
        collectedAt: collectedAt,
        standardVersion: 'IS10500-2012'
      };

      if (i < 5) {
        // TESTING status (5 samples) - waiting for lab values
        sample.lifecycleStatus = 'TESTING';
      } else {
        // PUBLISHED status (5 samples) - already submitted and auto-published
        sample.lifecycleStatus = 'PUBLISHED';
        sample.submittedBy = teamMember._id;
        sample.submittedAt = new Date(collectedAt.getTime() + 24 * 60 * 60 * 1000);
        sample.publishedAt = sample.submittedAt; // Auto-publish at same time

        // Add test parameters with values
        sample.parameters = generateTestParameters(allParams, i);
        sample.overallStatus = calculateOverallStatus(sample.parameters);
      }

      samples.push(sample);
    }

    await Sample.insertMany(samples);
    console.log(`  Created ${samples.length} samples:`);
    console.log('    - 5 TESTING (waiting for lab values)');
    console.log('    - 5 PUBLISHED (submitted and auto-published)');
  } catch (error) {
    console.error('Error seeding samples:', error.message);
  }
};

// Generate test parameters with realistic values
function generateTestParameters(allParams, sampleIndex) {
  const params = [];

  for (const param of allParams) {
    let value;
    let status;

    if (param.type === 'TEXT') {
      // Temperature - free text
      value = `${20 + Math.floor(Math.random() * 15)}°C`;
      status = 'ACCEPTABLE';
    } else if (param.type === 'RANGE') {
      // pH: Generate value in range
      const min = param.acceptableLimit.min || 0;
      const max = param.acceptableLimit.max || 14;

      if (sampleIndex % 3 === 0) {
        value = min + (max - min) * 0.5; // Middle - ACCEPTABLE
        status = 'ACCEPTABLE';
      } else if (sampleIndex % 3 === 1) {
        value = max + 0.5; // Above max - NOT_ACCEPTABLE
        status = 'NOT_ACCEPTABLE';
      } else {
        value = min + (max - min) * 0.3; // Lower middle - ACCEPTABLE
        status = 'ACCEPTABLE';
      }
      value = Math.round(value * 10) / 10;
    } else if (param.type === 'MAX') {
      const accMax = param.acceptableLimit.max || 100;
      const permMax = param.permissibleLimit.max || accMax * 2;

      if (sampleIndex % 3 === 0) {
        value = accMax * 0.5; // Below acceptable - ACCEPTABLE
        status = 'ACCEPTABLE';
      } else if (sampleIndex % 3 === 1) {
        value = accMax * 1.5; // Between acceptable and permissible - PERMISSIBLE
        status = permMax > accMax ? 'PERMISSIBLE' : 'NOT_ACCEPTABLE';
      } else {
        value = accMax * 0.8; // Just below acceptable - ACCEPTABLE
        status = 'ACCEPTABLE';
      }
      value = Math.round(value * 100) / 100;
    } else if (param.type === 'ENUM') {
      // For ENUM, select first value (acceptable one)
      value = param.enumValues[0];
      status = 'ACCEPTABLE';
    }

    params.push({
      parameterRef: param._id,
      code: param.code,
      name: param.name,
      unit: param.unit,
      type: param.type,
      acceptableLimit: param.acceptableLimit,
      permissibleLimit: param.permissibleLimit,
      enumValues: param.enumValues || [],
      testMethod: param.testMethod,
      value: value,
      status: status
    });
  }

  return params;
}

// Calculate overall status from parameters
function calculateOverallStatus(parameters) {
  if (!parameters || parameters.length === 0) return null;

  const hasNotAcceptable = parameters.some(p => p.status === 'NOT_ACCEPTABLE');
  if (hasNotAcceptable) return 'NOT_ACCEPTABLE';

  const hasPermissible = parameters.some(p => p.status === 'PERMISSIBLE');
  if (hasPermissible) return 'PERMISSIBLE';

  return 'ACCEPTABLE';
}

// Reset and Seed All (for npm run seed:reset)
const resetAndSeed = async () => {
  const { AuditLog } = require('../models');

  try {
    console.log('\n--- Dropping all collections ---');
    await Promise.all([
      Sample.deleteMany({}),
      User.deleteMany({}),
      ParameterMaster.deleteMany({}),
      AuditLog.deleteMany({})
    ]);
    console.log('All collections dropped\n');

    console.log('--- Seeding Users ---');
    await seedAdmin();
    await seedTeamMember();

    console.log('\n--- Seeding Parameters (12 total) ---');
    await seedParameters();

    console.log('\n--- Seeding Samples ---');
    await seedSampleData();

    console.log('\n========================================');
    console.log('  SEEDING COMPLETE!');
    console.log('========================================');
    console.log('\nTest Credentials:');
    console.log('  ADMIN:        admin@waterquality.com / admin123');
    console.log('  TEAM_MEMBER:  team@waterquality.com / team123');
    console.log('\nSample Distribution:');
    console.log('  5 TESTING   - waiting for lab values');
    console.log('  5 PUBLISHED - submitted and auto-published');
    console.log('');
  } catch (error) {
    console.error('Error in resetAndSeed:', error.message);
    throw error;
  }
};

module.exports = {
  seedParameters,
  seedAdmin,
  seedTeamMember,
  seedSampleData,
  resetAndSeed
};
