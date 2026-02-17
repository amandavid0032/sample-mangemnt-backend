const mongoose = require('mongoose');
const { lifecycleStatuses, parameterStatuses, standardVersion } = require('../config');

// Limit schema for snapshot
const limitSchema = new mongoose.Schema({
  min: { type: Number, default: null },
  max: { type: Number, default: null }
}, { _id: false });

// IMMUTABLE PARAMETER SNAPSHOT - stores regulatory limits at time of analysis
const parameterSnapshotSchema = new mongoose.Schema({
  parameterRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParameterMaster',
    required: true
  },
  // SNAPSHOT BLOCK (IMMUTABLE) - captured from ParameterMaster at analysis time
  code: { type: String, required: true },
  name: { type: String, required: true },
  unit: { type: String, required: true },
  type: {
    type: String,
    enum: ['RANGE', 'MAX', 'ENUM', 'TEXT'],
    required: true
  },
  acceptableLimit: { type: limitSchema, default: { min: null, max: null } },
  permissibleLimit: { type: limitSchema, default: { min: null, max: null } },
  maxValue: { type: Number, default: null },
  enumValues: { type: [String], default: [] },
  testMethod: { type: String, default: '' },

  // LAB VALUE - actual measured/observed value
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // COMPUTED RESULT
  status: {
    type: String,
    enum: parameterStatuses,
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

  // Collection info
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

  // Lifecycle status (simplified: TESTING → PUBLISHED → ARCHIVED)
  lifecycleStatus: {
    type: String,
    enum: lifecycleStatuses,
    default: 'TESTING'
  },

  // Workflow timestamps and user refs
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  submittedAt: {
    type: Date,
    default: null
  },
  publishedAt: {
    type: Date,
    default: null
  },

  // Standard version at time of analysis
  standardVersion: {
    type: String,
    default: standardVersion
  },

  // IMMUTABLE PARAMETER SNAPSHOTS
  parameters: {
    type: [parameterSnapshotSchema],
    default: []
  },

  // Overall status (worst of all parameter statuses)
  overallStatus: {
    type: String,
    enum: parameterStatuses,
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
sampleSchema.index({ isDeleted: 1 });
sampleSchema.index({ collectedBy: 1 });
sampleSchema.index({ submittedBy: 1 });

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

// Valid lifecycle transitions (simplified workflow)
// TESTING → PUBLISHED (auto on submit) → ARCHIVED
const VALID_TRANSITIONS = {
  'TESTING': ['PUBLISHED'],
  'PUBLISHED': ['ARCHIVED'],
  'ARCHIVED': ['PUBLISHED']  // Can restore to PUBLISHED
};

sampleSchema.statics.isValidTransition = function(currentStatus, newStatus) {
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
};

sampleSchema.statics.getValidTransitions = function(currentStatus) {
  return VALID_TRANSITIONS[currentStatus] || [];
};

// Calculate overall status from parameters
sampleSchema.methods.calculateOverallStatus = function() {
  if (this.parameters.length === 0) return null;

  // Rule: If any NOT_ACCEPTABLE → overall NOT_ACCEPTABLE
  const hasNotAcceptable = this.parameters.some(p => p.status === 'NOT_ACCEPTABLE');
  if (hasNotAcceptable) return 'NOT_ACCEPTABLE';

  // Rule: Else if any PERMISSIBLE → overall PERMISSIBLE
  const hasPermissible = this.parameters.some(p => p.status === 'PERMISSIBLE');
  if (hasPermissible) return 'PERMISSIBLE';

  // Rule: Else → ACCEPTABLE
  return 'ACCEPTABLE';
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

// Soft delete
sampleSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.lifecycleStatus = 'ARCHIVED';
};

module.exports = mongoose.model('Sample', sampleSchema);
