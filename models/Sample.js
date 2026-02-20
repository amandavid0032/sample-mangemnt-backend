const mongoose = require('mongoose');
const { parameterStatuses, standardVersion } = require('../config');

// Limit schema for snapshot
const limitSchema = new mongoose.Schema({
  min: { type: Number, default: null },
  max: { type: Number, default: null }
}, { _id: false });

// FIELD parameter - just stores value (no status yet)
const fieldParameterSchema = new mongoose.Schema({
  parameterRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParameterMaster',
    required: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  }
}, { _id: false });

// FULL parameter snapshot - with status (after LAB test)
const parameterSnapshotSchema = new mongoose.Schema({
  parameterRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParameterMaster',
    required: true
  },
  // SNAPSHOT BLOCK - captured from ParameterMaster at test time
  code: { type: String },
  name: { type: String },
  unit: { type: String },
  type: {
    type: String,
    enum: ['RANGE', 'MAX', 'ENUM', 'TEXT']
  },
  testLocation: {
    type: String,
    enum: ['FIELD', 'LAB']
  },
  acceptableLimit: { type: limitSchema, default: { min: null, max: null } },
  permissibleLimit: { type: limitSchema, default: { min: null, max: null } },
  physicalLimit: { type: limitSchema, default: { min: null, max: null } },
  maxValue: { type: Number, default: null },
  enumEvaluation: {
    type: Map,
    of: String,
    default: new Map()
  },
  testMethod: { type: String, default: '' },
  affectsOverall: { type: Boolean, default: true },

  // MEASURED VALUE
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // COMPUTED RESULT (null until LAB test)
  status: {
    type: String,
    enum: {
      values: [...parameterStatuses, null],
      message: 'Status must be one of: ACCEPTABLE, PERMISSIBLE, NOT_ACCEPTABLE'
    },
    default: null
  }
}, { _id: false });

// GeoJSON Point schema
const locationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point'
  },
  coordinates: {
    type: [Number],  // [longitude, latitude]
    required: true
  }
}, { _id: false });

// Images schema
const imagesSchema = new mongoose.Schema({
  sampleImageUrl: { type: String, default: null },
  locationImageUrl: { type: String, default: null }
}, { _id: false });

// testInfo schema - contains all test status info in one object
const testInfoSchema = new mongoose.Schema({
  // FIELD TEST
  fieldTested: { type: Boolean, default: false },
  fieldTestedAt: { type: Date, default: null },

  // LAB TEST
  labTested: { type: Boolean, default: false },
  labTestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  labTestedAt: { type: Date, default: null },

  // PUBLISHED
  published: { type: Boolean, default: false },
  publishedAt: { type: Date, default: null }
}, { _id: false });

const sampleSchema = new mongoose.Schema({
  sampleId: {
    type: String
  },

  // Sample title
  title: {
    type: String,
    required: [true, 'Sample title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },

  // Location
  location: {
    type: locationSchema,
    required: [true, 'Location coordinates are required']
  },
  address: {
    type: String,
    trim: true,
    maxlength: [500, 'Address cannot exceed 500 characters'],
    default: null
  },

  // Collection info (who created the sample - also did FIELD test)
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Collector information is required']
  },
  collectedAt: {
    type: Date,
    required: [true, 'Collection date is required']
  },

  // Images (both required)
  images: {
    type: imagesSchema,
    default: { sampleImageUrl: null, locationImageUrl: null }
  },

  // Test info - all test status in one object
  testInfo: {
    type: testInfoSchema,
    default: {
      fieldTested: false,
      fieldTestedAt: null,
      labTested: false,
      labTestedBy: null,
      labTestedAt: null,
      published: false,
      publishedAt: null
    }
  },

  // Standard version at time of testing
  standardVersion: {
    type: String,
    default: standardVersion
  },

  // PARAMETER VALUES
  // During FIELD test: stores {parameterRef, value} only
  // After LAB test: stores full snapshot with status
  parameters: {
    type: [parameterSnapshotSchema],
    default: []
  },

  // Overall status (calculated after LAB test)
  // NULL until LAB test complete
  overallStatus: {
    type: String,
    enum: {
      values: [...parameterStatuses, null],
      message: 'Overall status must be one of: ACCEPTABLE, PERMISSIBLE, NOT_ACCEPTABLE'
    },
    default: null
  },

  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
sampleSchema.index({ sampleId: 1 }, { unique: true });
sampleSchema.index({ location: '2dsphere' });
sampleSchema.index({ 'testInfo.fieldTested': 1, createdAt: -1 });
sampleSchema.index({ 'testInfo.labTested': 1 });
sampleSchema.index({ 'testInfo.published': 1 });
sampleSchema.index({ overallStatus: 1 });
sampleSchema.index({ 'parameters.code': 1 });
sampleSchema.index({ 'parameters.testLocation': 1 });
sampleSchema.index({ isDeleted: 1 });
sampleSchema.index({ 'testInfo.labTestedBy': 1 });
// Compound index for mobile queries (collectedBy + isDeleted + createdAt)
sampleSchema.index({ collectedBy: 1, isDeleted: 1, createdAt: -1 });

// Auto-generate sampleId
sampleSchema.pre('save', async function(next) {
  if (!this.sampleId) {
    const count = await this.constructor.countDocuments();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    this.sampleId = `SMP-${year}${month}-${(count + 1).toString().padStart(5, '0')}`;
  }
  next();
});

/**
 * Calculate overall status from parameters
 * Only called after LAB test (all parameters have status)
 */
sampleSchema.methods.calculateOverallStatus = function() {
  if (this.parameters.length === 0) return null;

  // Filter to only parameters that affect overall status and have status
  const affectingParams = this.parameters.filter(p => p.affectsOverall !== false && p.status);

  if (affectingParams.length === 0) return 'ACCEPTABLE';

  // Rule: If any NOT_ACCEPTABLE → overall NOT_ACCEPTABLE
  const hasNotAcceptable = affectingParams.some(p => p.status === 'NOT_ACCEPTABLE');
  if (hasNotAcceptable) return 'NOT_ACCEPTABLE';

  // Rule: Else if any PERMISSIBLE → overall PERMISSIBLE
  const hasPermissible = affectingParams.some(p => p.status === 'PERMISSIBLE');
  if (hasPermissible) return 'PERMISSIBLE';

  // Rule: Else → ACCEPTABLE
  return 'ACCEPTABLE';
};

/**
 * Get FIELD parameters only
 */
sampleSchema.methods.getFieldParameters = function() {
  return this.parameters.filter(p => p.testLocation === 'FIELD');
};

/**
 * Get LAB parameters only
 */
sampleSchema.methods.getLabParameters = function() {
  return this.parameters.filter(p => p.testLocation === 'LAB');
};

// Get coordinates as lat/lng object
sampleSchema.methods.getCoordinates = function() {
  if (this.location && this.location.coordinates) {
    return {
      longitude: this.location.coordinates[0],
      latitude: this.location.coordinates[1]
    };
  }
  return { latitude: 0, longitude: 0 };
};

// Convert enumEvaluation Maps to plain objects for JSON
sampleSchema.methods.toJSON = function() {
  const obj = this.toObject();
  if (obj.parameters) {
    obj.parameters = obj.parameters.map(param => {
      if (param.enumEvaluation instanceof Map) {
        param.enumEvaluation = Object.fromEntries(param.enumEvaluation);
      }
      return param;
    });
  }
  return obj;
};

module.exports = mongoose.model('Sample', sampleSchema);
