/**
 * Seed Parameters and Users for Water Quality System
 * Based on IS 10500:2012 Indian Standard for Drinking Water
 *
 * NEW WORKFLOW: FIELD + LAB Hybrid Testing
 *
 * USER ROLES:
 * - ADMIN: Lab testing + Publish + Archive
 * - TEAM_MEMBER: Field collection + Field testing
 *
 * LIFECYCLE:
 * COLLECTED → FIELD_TESTED → LAB_TESTED → PUBLISHED → ARCHIVED
 *
 * TEST LOCATIONS:
 * - FIELD: pH, Temperature, Apparent Colour, Odour, Turbidity (5 params)
 * - LAB: TDS, True Colour, Aluminum, Ammonia, Chloride, Free Chlorine, Hardness (7 params)
 */

const { ParameterMaster, User, Sample } = require('../models');

// IS 10500:2012 Parameters (12 parameters)
// Split into FIELD and LAB testLocation
const parameters = [
  // ========== FIELD PARAMETERS (5) ==========
  // Tested on-site by TEAM_MEMBER

  // 1. Temperature - TEXT (informational only, doesn't affect overall status)
  {
    code: 'TEMPERATURE',
    name: 'Temperature',
    unit: '°C',
    type: 'TEXT',
    testLocation: 'FIELD',
    acceptableLimit: { min: null, max: null },
    permissibleLimit: { min: null, max: null },
    physicalLimit: { min: -50, max: 100 },
    affectsOverall: false,
    testMethod: 'IS 3025 (Part 9)',
    isActive: true
  },
  // 2. pH - RANGE (6.5 to 8.5), physical: 0-14
  {
    code: 'PH',
    name: 'pH',
    unit: '-',
    type: 'RANGE',
    testLocation: 'FIELD',
    acceptableLimit: { min: 6.5, max: 8.5 },
    permissibleLimit: { min: 6.0, max: 9.0 },
    physicalLimit: { min: 0, max: 14 },
    affectsOverall: true,
    testMethod: 'IS 3025 (Part 11)',
    isActive: true
  },
  // 3. Apparent Colour - ENUM with status mapping
  {
    code: 'APPARENT_COLOUR',
    name: 'Apparent Colour',
    unit: '-',
    type: 'ENUM',
    testLocation: 'FIELD',
    enumEvaluation: {
      'Clear': 'ACCEPTABLE',
      'Yellowish': 'PERMISSIBLE',
      'Brownish': 'NOT_ACCEPTABLE',
      'Blackish': 'NOT_ACCEPTABLE'
    },
    acceptableLimit: { min: null, max: null },
    permissibleLimit: { min: null, max: null },
    physicalLimit: { min: null, max: null },
    affectsOverall: true,
    testMethod: 'Visual',
    isActive: true
  },
  // 4. Odour - ENUM with status mapping
  {
    code: 'ODOUR',
    name: 'Odour',
    unit: '-',
    type: 'ENUM',
    testLocation: 'FIELD',
    enumEvaluation: {
      'Unobjectionable': 'ACCEPTABLE',
      'Earthy': 'PERMISSIBLE',
      'Sewer smell': 'NOT_ACCEPTABLE'
    },
    acceptableLimit: { min: null, max: null },
    permissibleLimit: { min: null, max: null },
    physicalLimit: { min: null, max: null },
    affectsOverall: true,
    testMethod: 'IS 3025 (Part 5)',
    isActive: true
  },
  // 5. Turbidity - MAX (1 NTU), physical: 0+
  {
    code: 'TURBIDITY',
    name: 'Turbidity',
    unit: 'NTU',
    type: 'MAX',
    testLocation: 'FIELD',
    acceptableLimit: { min: null, max: 1 },
    permissibleLimit: { min: null, max: 5 },
    physicalLimit: { min: 0, max: 10000 },
    affectsOverall: true,
    testMethod: 'IS 3025 (Part 10)',
    isActive: true
  },

  // ========== LAB PARAMETERS (7) ==========
  // Tested in laboratory by ADMIN

  // 6. True Colour - MAX (5 Hazen), physical: 0+
  {
    code: 'TRUE_COLOUR',
    name: 'True Colour',
    unit: 'Hazen',
    type: 'MAX',
    testLocation: 'LAB',
    acceptableLimit: { min: null, max: 5 },
    permissibleLimit: { min: null, max: 15 },
    physicalLimit: { min: 0, max: 1000 },
    affectsOverall: true,
    testMethod: 'IS 3025 (Part 4)',
    isActive: true
  },
  // 7. Total Dissolved Solids - MAX (500 mg/L), physical: 0+
  {
    code: 'TDS',
    name: 'Total Dissolved Solids',
    unit: 'mg/L',
    type: 'MAX',
    testLocation: 'LAB',
    acceptableLimit: { min: null, max: 500 },
    permissibleLimit: { min: null, max: 2000 },
    physicalLimit: { min: 0, max: 100000 },
    affectsOverall: true,
    testMethod: 'IS 3025 (Part 16)',
    isActive: true
  },
  // 8. Aluminum - MAX (0.03 mg/L), physical: 0+
  {
    code: 'ALUMINUM',
    name: 'Aluminum (as Al)',
    unit: 'mg/L',
    type: 'MAX',
    testLocation: 'LAB',
    acceptableLimit: { min: null, max: 0.03 },
    permissibleLimit: { min: null, max: 0.2 },
    physicalLimit: { min: 0, max: 1000 },
    affectsOverall: true,
    testMethod: 'IS 3025 (Part 55)',
    isActive: true
  },
  // 9. Ammonia - MAX (0.5 mg/L), physical: 0+
  {
    code: 'AMMONIA',
    name: 'Ammonia (as Total Ammonia-N)',
    unit: 'mg/L',
    type: 'MAX',
    testLocation: 'LAB',
    acceptableLimit: { min: null, max: 0.5 },
    permissibleLimit: { min: null, max: 0.5 },
    physicalLimit: { min: 0, max: 1000 },
    affectsOverall: true,
    testMethod: 'IS 3025 (Part 34)',
    isActive: true
  },
  // 10. Chloride - MAX (250 mg/L), physical: 0+
  {
    code: 'CHLORIDE',
    name: 'Chloride (as Cl)',
    unit: 'mg/L',
    type: 'MAX',
    testLocation: 'LAB',
    acceptableLimit: { min: null, max: 250 },
    permissibleLimit: { min: null, max: 1000 },
    physicalLimit: { min: 0, max: 100000 },
    affectsOverall: true,
    testMethod: 'IS 3025 (Part 32)',
    isActive: true
  },
  // 11. Free Residual Chlorine - MAX (0.2 mg/L), physical: 0+
  {
    code: 'FREE_CHLORINE',
    name: 'Free Residual Chlorine',
    unit: 'mg/L',
    type: 'MAX',
    testLocation: 'LAB',
    acceptableLimit: { min: null, max: 0.2 },
    permissibleLimit: { min: null, max: 1.0 },
    physicalLimit: { min: 0, max: 100 },
    affectsOverall: true,
    testMethod: 'IS 3025 (Part 26)',
    isActive: true
  },
  // 12. Total Hardness - MAX (200 mg/L), physical: 0+
  {
    code: 'HARDNESS',
    name: 'Total Hardness (as CaCO3)',
    unit: 'mg/L',
    type: 'MAX',
    testLocation: 'LAB',
    acceptableLimit: { min: null, max: 200 },
    permissibleLimit: { min: null, max: 600 },
    physicalLimit: { min: 0, max: 100000 },
    affectsOverall: true,
    testMethod: 'IS 3025 (Part 21)',
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
        console.log(`  Created parameter: ${param.code} (${param.testLocation})`);
      }
    }
    const fieldParams = parameters.filter(p => p.testLocation === 'FIELD').length;
    const labParams = parameters.filter(p => p.testLocation === 'LAB').length;
    console.log(`Parameters seeded: ${fieldParams} FIELD + ${labParams} LAB = ${parameters.length} total`);
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

// Seed Sample Data for Testing (NEW lifecycle workflow)
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

    const fieldParams = await ParameterMaster.find({ testLocation: 'FIELD', isActive: true });
    const labParams = await ParameterMaster.find({ testLocation: 'LAB', isActive: true });

    if (fieldParams.length === 0 || labParams.length === 0) {
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

    // Create samples with NEW lifecycle:
    // 2 COLLECTED, 2 FIELD_TESTED, 3 LAB_TESTED, 3 PUBLISHED
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

      if (i < 2) {
        // COLLECTED status (2 samples) - waiting for field test
        sample.lifecycleStatus = 'COLLECTED';
      } else if (i < 4) {
        // FIELD_TESTED status (2 samples) - field test done, waiting for lab test
        sample.lifecycleStatus = 'FIELD_TESTED';
        sample.fieldTestedBy = teamMember._id;
        sample.fieldTestedAt = new Date(collectedAt.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
        sample.parameters = generateFieldParameters(fieldParams, i);
        // No overallStatus yet
      } else if (i < 7) {
        // LAB_TESTED status (3 samples) - all tests done, waiting for publish
        sample.lifecycleStatus = 'LAB_TESTED';
        sample.fieldTestedBy = teamMember._id;
        sample.fieldTestedAt = new Date(collectedAt.getTime() + 2 * 60 * 60 * 1000);
        sample.labTestedBy = admin._id;
        sample.labTestedAt = new Date(collectedAt.getTime() + 24 * 60 * 60 * 1000);
        const allParams = [
          ...generateFieldParameters(fieldParams, i),
          ...generateLabParameters(labParams, i)
        ];
        sample.parameters = allParams;
        sample.overallStatus = calculateOverallStatus(allParams);
      } else {
        // PUBLISHED status (3 samples) - fully published
        sample.lifecycleStatus = 'PUBLISHED';
        sample.fieldTestedBy = teamMember._id;
        sample.fieldTestedAt = new Date(collectedAt.getTime() + 2 * 60 * 60 * 1000);
        sample.labTestedBy = admin._id;
        sample.labTestedAt = new Date(collectedAt.getTime() + 24 * 60 * 60 * 1000);
        sample.publishedBy = admin._id;
        sample.publishedAt = new Date(collectedAt.getTime() + 48 * 60 * 60 * 1000);
        const allParams = [
          ...generateFieldParameters(fieldParams, i),
          ...generateLabParameters(labParams, i)
        ];
        sample.parameters = allParams;
        sample.overallStatus = calculateOverallStatus(allParams);
      }

      samples.push(sample);
    }

    await Sample.insertMany(samples);
    console.log(`  Created ${samples.length} samples:`);
    console.log('    - 2 COLLECTED (waiting for field test)');
    console.log('    - 2 FIELD_TESTED (waiting for lab test)');
    console.log('    - 3 LAB_TESTED (waiting for publish)');
    console.log('    - 3 PUBLISHED (fully published)');
  } catch (error) {
    console.error('Error seeding samples:', error.message);
  }
};

// Generate FIELD parameters with realistic values
function generateFieldParameters(fieldParams, sampleIndex) {
  const params = [];

  for (const param of fieldParams) {
    let value;
    let status;

    if (param.type === 'TEXT') {
      value = `${20 + Math.floor(Math.random() * 15)}`;
      status = 'ACCEPTABLE';
    } else if (param.type === 'RANGE') {
      const min = param.acceptableLimit.min || 0;
      const max = param.acceptableLimit.max || 14;

      if (sampleIndex % 3 === 0) {
        value = min + (max - min) * 0.5;
        status = 'ACCEPTABLE';
      } else if (sampleIndex % 3 === 1) {
        value = max + 0.5;
        status = 'NOT_ACCEPTABLE';
      } else {
        value = min + (max - min) * 0.3;
        status = 'ACCEPTABLE';
      }
      value = Math.round(value * 10) / 10;
    } else if (param.type === 'MAX') {
      const accMax = param.acceptableLimit.max || 100;
      const permMax = param.permissibleLimit.max || accMax * 2;

      if (sampleIndex % 3 === 0) {
        value = accMax * 0.5;
        status = 'ACCEPTABLE';
      } else if (sampleIndex % 3 === 1) {
        value = accMax * 1.5;
        status = permMax > accMax ? 'PERMISSIBLE' : 'NOT_ACCEPTABLE';
      } else {
        value = accMax * 0.8;
        status = 'ACCEPTABLE';
      }
      value = Math.round(value * 100) / 100;
    } else if (param.type === 'ENUM') {
      // param.enumEvaluation is a Mongoose Map - convert to plain object
      const enumObj = param.enumEvaluation instanceof Map
        ? Object.fromEntries(param.enumEvaluation)
        : (param.enumEvaluation || {});
      const enumKeys = Object.keys(enumObj);
      if (enumKeys.length > 0) {
        const keyIndex = sampleIndex % enumKeys.length;
        value = enumKeys[keyIndex];
        status = enumObj[value] || 'ACCEPTABLE';
      } else {
        value = 'Unknown';
        status = 'NOT_ACCEPTABLE';
      }
    }

    // Convert Map to plain object for snapshot
    const enumEvalObj = param.enumEvaluation instanceof Map
      ? Object.fromEntries(param.enumEvaluation)
      : (param.enumEvaluation || {});

    params.push({
      parameterRef: param._id,
      code: param.code,
      name: param.name,
      unit: param.unit,
      type: param.type,
      testLocation: 'FIELD',
      acceptableLimit: param.acceptableLimit,
      permissibleLimit: param.permissibleLimit,
      physicalLimit: param.physicalLimit || { min: null, max: null },
      enumEvaluation: enumEvalObj,
      testMethod: param.testMethod,
      affectsOverall: param.affectsOverall !== false,
      value: value,
      status: status
    });
  }

  return params;
}

// Generate LAB parameters with realistic values
function generateLabParameters(labParams, sampleIndex) {
  const params = [];

  for (const param of labParams) {
    let value;
    let status;

    const accMax = param.acceptableLimit.max || 100;
    const permMax = param.permissibleLimit.max || accMax * 2;

    if (sampleIndex % 3 === 0) {
      value = accMax * 0.5;
      status = 'ACCEPTABLE';
    } else if (sampleIndex % 3 === 1) {
      value = accMax * 1.5;
      status = permMax > accMax ? 'PERMISSIBLE' : 'NOT_ACCEPTABLE';
    } else {
      value = accMax * 0.8;
      status = 'ACCEPTABLE';
    }
    value = Math.round(value * 100) / 100;

    params.push({
      parameterRef: param._id,
      code: param.code,
      name: param.name,
      unit: param.unit,
      type: param.type,
      testLocation: 'LAB',
      acceptableLimit: param.acceptableLimit,
      permissibleLimit: param.permissibleLimit,
      physicalLimit: param.physicalLimit || { min: null, max: null },
      enumEvaluation: {},
      testMethod: param.testMethod,
      affectsOverall: param.affectsOverall !== false,
      value: value,
      status: status
    });
  }

  return params;
}

// Calculate overall status from parameters
function calculateOverallStatus(parameters) {
  if (!parameters || parameters.length === 0) return null;

  const affectingParams = parameters.filter(p => p.affectsOverall !== false);

  if (affectingParams.length === 0) return 'ACCEPTABLE';

  const hasNotAcceptable = affectingParams.some(p => p.status === 'NOT_ACCEPTABLE');
  if (hasNotAcceptable) return 'NOT_ACCEPTABLE';

  const hasPermissible = affectingParams.some(p => p.status === 'PERMISSIBLE');
  if (hasPermissible) return 'PERMISSIBLE';

  return 'ACCEPTABLE';
}

// Reset and Seed All
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

    console.log('\n--- Seeding Parameters ---');
    await seedParameters();

    console.log('\n--- Seeding Samples ---');
    await seedSampleData();

    console.log('\n========================================');
    console.log('  SEEDING COMPLETE!');
    console.log('========================================');
    console.log('\nTest Credentials:');
    console.log('  ADMIN:        admin@waterquality.com / admin123');
    console.log('  TEAM_MEMBER:  team@waterquality.com / team123');
    console.log('\nParameters:');
    console.log('  5 FIELD: Temperature, pH, Apparent Colour, Odour, Turbidity');
    console.log('  7 LAB:   True Colour, TDS, Aluminum, Ammonia, Chloride, Free Chlorine, Hardness');
    console.log('\nSample Distribution:');
    console.log('  2 COLLECTED     - waiting for field test');
    console.log('  2 FIELD_TESTED  - waiting for lab test');
    console.log('  3 LAB_TESTED    - waiting for publish');
    console.log('  3 PUBLISHED     - fully published');
    console.log('\nNEW Lifecycle Flow:');
    console.log('  COLLECTED → FIELD_TESTED → LAB_TESTED → PUBLISHED → ARCHIVED');
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
