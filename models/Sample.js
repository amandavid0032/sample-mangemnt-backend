const mongoose = require('mongoose');
const { lifecycleStatuses, parameterStatuses, standardVersion } = require('../config');

// Limit schema for snapshot
const limitSchema = new mongoose.Schema({
  min: { type: Number, default: null },
  max: { type: Number, default: null }
}, { _id: false });

// IMMUTABLE PARAMETER SNAPSHOT - stores regulatory limits at time of testing
const parameterSnapshotSchema = new mongoose.Schema({
  parameterRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParameterMaster',
    required: true
  },
  // SNAPSHOT BLOCK (IMMUTABLE) - captured from ParameterMaster at test time
  code: { type: String, required: true },
  name: { type: String, required: true },
  unit: { type: String, required: true },
  type: {
    type: String,
    enum: ['RANGE', 'MAX', 'ENUM', 'TEXT'],
    required: true
  },
  // NEW: Where this parameter was tested
  testLocation: {
    type: String,
    enum: ['FIELD', 'LAB'],
    required: true
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

  // COMPUTED RESULT
  status: {
    type: String,
    enum: {
      values: parameterStatuses,
      message: 'Status must be one of: ACCEPTABLE, PERMISSIBLE, NOT_ACCEPTABLE'
    },
    required: true
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
    required: [true, 'Address is required'],
    trim: true,
    maxlength: [500, 'Address cannot exceed 500 characters']
  },

  // Selected parameters to test (FIELD parameters only for mobile)
  selectedParameters: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParameterMaster'
  }],

  // Collection info (who created the sample)
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Collector information is required']
  },
  collectedAt: {
    type: Date,
    required: [true, 'Collection date is required']
  },

  // Images
  images: {
    type: imagesSchema,
    default: { sampleImageUrl: null, locationImageUrl: null }
  },

  // NEW Lifecycle: COLLECTED → FIELD_TESTED → LAB_TESTED → PUBLISHED → ARCHIVED
  lifecycleStatus: {
    type: String,
    enum: {
      values: lifecycleStatuses,
      message: 'Lifecycle status must be one of: COLLECTED, FIELD_TESTED, LAB_TESTED, PUBLISHED, ARCHIVED'
    },
    default: 'COLLECTED'
  },

  // FIELD TEST - done by TEAM_MEMBER on-site
  fieldTestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  fieldTestedAt: {
    type: Date,
    default: null
  },

  // LAB TEST - done by ADMIN in laboratory
  labTestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  labTestedAt: {
    type: Date,
    default: null
  },

  // PUBLISHING - done by ADMIN
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  publishedAt: {
    type: Date,
    default: null
  },

  // Standard version at time of testing
  standardVersion: {
    type: String,
    default: standardVersion
  },

  // IMMUTABLE PARAMETER SNAPSHOTS (both FIELD and LAB)
  parameters: {
    type: [parameterSnapshotSchema],
    default: []
  },

  // Overall status (calculated after LAB_TESTED)
  // NULL until all testing complete
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
sampleSchema.index({ lifecycleStatus: 1, createdAt: -1 });
sampleSchema.index({ overallStatus: 1 });
sampleSchema.index({ 'parameters.code': 1 });
sampleSchema.index({ 'parameters.testLocation': 1 });
sampleSchema.index({ isDeleted: 1 });
sampleSchema.index({ collectedBy: 1 });
sampleSchema.index({ fieldTestedBy: 1 });
sampleSchema.index({ labTestedBy: 1 });

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
 * NEW Lifecycle Transitions:
 * COLLECTED → FIELD_TESTED (Team member submits field test)
 * FIELD_TESTED → LAB_TESTED (Admin submits lab test)
 * LAB_TESTED → PUBLISHED (Admin publishes)
 * PUBLISHED → ARCHIVED (Admin archives)
 * ARCHIVED → PUBLISHED (Admin restores)
 */
const VALID_TRANSITIONS = {
  'COLLECTED': ['FIELD_TESTED'],
  'FIELD_TESTED': ['LAB_TESTED'],
  'LAB_TESTED': ['PUBLISHED'],
  'PUBLISHED': ['ARCHIVED'],
  'ARCHIVED': ['PUBLISHED']
};

sampleSchema.statics.isValidTransition = function(currentStatus, newStatus) {
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
};

sampleSchema.statics.getValidTransitions = function(currentStatus) {
  return VALID_TRANSITIONS[currentStatus] || [];
};

/**
 * Calculate overall status from parameters
 * Only called after LAB_TESTED (all parameters submitted)
 */
sampleSchema.methods.calculateOverallStatus = function() {
  if (this.parameters.length === 0) return null;

  // Filter to only parameters that affect overall status
  const affectingParams = this.parameters.filter(p => p.affectsOverall !== false);

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

/**
 * Check if field testing is complete
 */
sampleSchema.methods.hasFieldTest = function() {
  return this.fieldTestedBy !== null && this.fieldTestedAt !== null;
};

/**
 * Check if lab testing is complete
 */
sampleSchema.methods.hasLabTest = function() {
  return this.labTestedBy !== null && this.labTestedAt !== null;
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

// Archive sample (soft delete + status change)
sampleSchema.methods.archive = function() {
  this.isDeleted = true;
  this.lifecycleStatus = 'ARCHIVED';
};

// Restore sample from archive
sampleSchema.methods.restore = function() {
  this.isDeleted = false;
  // Restore to PUBLISHED (archived samples were published before)
  this.lifecycleStatus = 'PUBLISHED';
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
