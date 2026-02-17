const mongoose = require('mongoose');
const { parameterTypes, standardVersion } = require('../config');

// Limit schema for nested min/max values
const limitSchema = new mongoose.Schema({
  min: {
    type: Number,
    default: null
  },
  max: {
    type: Number,
    default: null
  }
}, { _id: false });

const parameterMasterSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Parameter code is required'],
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Parameter name is required'],
    trim: true
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    trim: true
  },
  type: {
    type: String,
    enum: {
      values: parameterTypes,
      message: 'Type must be one of: RANGE, MAX, ENUM, TEXT'
    },
    required: [true, 'Parameter type is required'],
    uppercase: true
  },
  // For RANGE and MAX types - acceptable limit range
  acceptableLimit: {
    type: limitSchema,
    default: { min: null, max: null }
  },
  // For RANGE and MAX types - permissible limit range
  permissibleLimit: {
    type: limitSchema,
    default: { min: null, max: null }
  },
  // For MAX type - maximum allowed value
  maxValue: {
    type: Number,
    default: null
  },
  // For ENUM type - list of valid values
  enumValues: {
    type: [String],
    default: []
  },
  // Test method reference string
  testMethod: {
    type: String,
    trim: true,
    default: ''
  },
  // Standard version (e.g., "IS10500-2012")
  standardVersion: {
    type: String,
    default: standardVersion,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
parameterMasterSchema.index({ code: 1 }, { unique: true });
parameterMasterSchema.index({ isActive: 1 });

/**
 * Calculate status based on value and parameter rules
 * Returns: ACCEPTABLE | PERMISSIBLE | NOT_ACCEPTABLE
 */
parameterMasterSchema.methods.calculateStatus = function(value) {
  if (value === null || value === undefined || value === '') {
    return 'ACCEPTABLE';
  }

  switch (this.type) {
    case 'RANGE':
      return this.calculateRangeStatus(parseFloat(value));
    case 'MAX':
      return this.calculateMaxStatus(parseFloat(value));
    case 'ENUM':
      return this.calculateEnumStatus(value);
    case 'TEXT':
      return 'ACCEPTABLE'; // Text type always returns ACCEPTABLE
    default:
      return 'ACCEPTABLE';
  }
};

/**
 * RANGE Logic
 * ACCEPTABLE: within acceptableLimit range
 * PERMISSIBLE: within permissibleLimit range
 * NOT_ACCEPTABLE: outside both ranges
 */
parameterMasterSchema.methods.calculateRangeStatus = function(value) {
  const acceptable = this.acceptableLimit;
  const permissible = this.permissibleLimit;

  // Check acceptable range
  if (acceptable && acceptable.min !== null && acceptable.max !== null) {
    if (value >= acceptable.min && value <= acceptable.max) {
      return 'ACCEPTABLE';
    }
  }

  // Check permissible range
  if (permissible && permissible.min !== null && permissible.max !== null) {
    if (value >= permissible.min && value <= permissible.max) {
      return 'PERMISSIBLE';
    }
  }

  return 'NOT_ACCEPTABLE';
};

/**
 * MAX Logic
 * ACCEPTABLE: value <= acceptableLimit.max
 * PERMISSIBLE: value <= permissibleLimit.max
 * NOT_ACCEPTABLE: value > permissibleLimit.max (or > acceptableLimit if no permissible)
 */
parameterMasterSchema.methods.calculateMaxStatus = function(value) {
  const acceptable = this.acceptableLimit;
  const permissible = this.permissibleLimit;

  // Use maxValue if acceptableLimit not set
  const acceptableMax = (acceptable && acceptable.max !== null) ? acceptable.max : this.maxValue;
  const permissibleMax = (permissible && permissible.max !== null) ? permissible.max : null;

  if (acceptableMax === null) return 'ACCEPTABLE';

  if (value <= acceptableMax) {
    return 'ACCEPTABLE';
  } else if (permissibleMax !== null && value <= permissibleMax) {
    return 'PERMISSIBLE';
  } else {
    return 'NOT_ACCEPTABLE';
  }
};

/**
 * ENUM Logic
 * Value must exist in enumValues
 * Returns ACCEPTABLE if found, NOT_ACCEPTABLE if not
 */
parameterMasterSchema.methods.calculateEnumStatus = function(value) {
  if (!this.enumValues || this.enumValues.length === 0) {
    return 'ACCEPTABLE';
  }

  const normalizedValue = value.toString().toLowerCase().trim();
  const found = this.enumValues.some(
    enumVal => enumVal.toLowerCase().trim() === normalizedValue
  );

  return found ? 'ACCEPTABLE' : 'NOT_ACCEPTABLE';
};

/**
 * Get limit display string for UI
 */
parameterMasterSchema.methods.getLimitDisplayString = function() {
  switch (this.type) {
    case 'RANGE':
      const acc = this.acceptableLimit;
      if (acc && acc.min !== null && acc.max !== null) {
        return `${acc.min} - ${acc.max}`;
      }
      return 'N/A';
    case 'MAX':
      const accMax = this.acceptableLimit?.max || this.maxValue;
      const permMax = this.permissibleLimit?.max;
      if (permMax !== null) {
        return `Acceptable: ≤${accMax}, Permissible: ≤${permMax}`;
      }
      return `≤ ${accMax}`;
    case 'ENUM':
      return this.enumValues.join(', ');
    case 'TEXT':
      return 'N/A';
    default:
      return 'N/A';
  }
};

/**
 * Create snapshot data for embedding in Sample
 */
parameterMasterSchema.methods.createSnapshot = function() {
  return {
    parameterRef: this._id,
    code: this.code,
    name: this.name,
    unit: this.unit,
    type: this.type,
    acceptableLimit: this.acceptableLimit,
    permissibleLimit: this.permissibleLimit,
    maxValue: this.maxValue,
    enumValues: this.enumValues,
    testMethod: this.testMethod
  };
};

module.exports = mongoose.model('ParameterMaster', parameterMasterSchema);
