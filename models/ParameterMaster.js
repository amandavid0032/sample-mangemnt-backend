const mongoose = require('mongoose');
const { parameterTypes, parameterStatuses, standardVersion, testLocations } = require('../config');

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
  // Where this parameter is tested - FIELD (on-site) or LAB (laboratory)
  testLocation: {
    type: String,
    enum: {
      values: testLocations,
      message: 'testLocation must be FIELD or LAB'
    },
    default: 'LAB',
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
  // Physical boundary limits (e.g., pH: 0-14, TDS: 0+)
  // Values outside these are physically impossible/invalid
  physicalLimit: {
    type: limitSchema,
    default: { min: null, max: null }
  },
  // Whether this parameter affects overall status calculation
  // TEXT type parameters should have this as false
  affectsOverall: {
    type: Boolean,
    default: true
  },
  // For MAX type - maximum allowed value (deprecated, use acceptableLimit.max)
  maxValue: {
    type: Number,
    default: null
  },
  // NEW: For ENUM type - maps values to their status
  // Example: { "Clear": "ACCEPTABLE", "Yellowish": "PERMISSIBLE", "Brownish": "NOT_ACCEPTABLE" }
  enumEvaluation: {
    type: Map,
    of: {
      type: String,
      enum: {
        values: parameterStatuses,
        message: 'Enum status must be one of: ACCEPTABLE, PERMISSIBLE, NOT_ACCEPTABLE'
      }
    },
    default: new Map()
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
 * Validate value against physical limits
 * Must be called BEFORE calculateStatus()
 *
 * Validation Order (CRITICAL):
 * 1. Check null/undefined/empty → reject
 * 2. For RANGE/MAX: check numeric, then physical limits → reject if invalid
 * 3. For ENUM: check value exists in enumEvaluation → reject if invalid
 * 4. For TEXT: validate string format → reject if invalid
 *
 * Returns { isValid: boolean, error: string|null }
 */
parameterMasterSchema.methods.validatePhysicalLimits = function(value) {
  // STEP 1: Reject null/undefined/empty values FIRST
  if (value === null || value === undefined || value === '') {
    return { isValid: false, error: `${this.name}: Value is required. Cannot submit empty values.` };
  }

  // STEP 2: Validate numeric types against physical limits
  if (this.type === 'RANGE' || this.type === 'MAX') {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return { isValid: false, error: `${this.name} must be a valid number` };
    }

    const physical = this.physicalLimit;
    if (physical) {
      if (physical.min !== null && numValue < physical.min) {
        return {
          isValid: false,
          error: `${this.name} cannot be less than ${physical.min} (physical minimum)`
        };
      }
      if (physical.max !== null && numValue > physical.max) {
        return {
          isValid: false,
          error: `${this.name} cannot be greater than ${physical.max} (physical maximum)`
        };
      }
    }
  }

  // STEP 3: Validate ENUM type - value must exist in enumEvaluation keys
  // Invalid enum value = invalid input, NOT bad water quality
  if (this.type === 'ENUM') {
    const enumKeys = this.getEnumKeys();
    if (enumKeys.length === 0) {
      return { isValid: false, error: `${this.name}: No enumEvaluation configured. Contact admin.` };
    }

    const normalizedValue = value.toString().trim();
    const matchedKey = enumKeys.find(
      key => key.toLowerCase() === normalizedValue.toLowerCase()
    );

    if (!matchedKey) {
      return {
        isValid: false,
        error: `${this.name}: Invalid value "${value}". Must be one of: ${enumKeys.join(', ')}`
      };
    }
  }

  // STEP 4: TEXT type - validate string format
  if (this.type === 'TEXT') {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return { isValid: false, error: `${this.name} must be text` };
    }
    if (value.toString().length > 500) {
      return { isValid: false, error: `${this.name} cannot exceed 500 characters` };
    }
  }

  return { isValid: true, error: null };
};

/**
 * Get enum keys as array
 */
parameterMasterSchema.methods.getEnumKeys = function() {
  if (!this.enumEvaluation || this.enumEvaluation.size === 0) {
    return [];
  }
  return Array.from(this.enumEvaluation.keys());
};

/**
 * Calculate status based on value and parameter rules
 * Returns: ACCEPTABLE | PERMISSIBLE | NOT_ACCEPTABLE
 *
 * IMPORTANT: Always call validatePhysicalLimits() BEFORE this method.
 * This method throws errors for invalid data as a defensive measure.
 */
parameterMasterSchema.methods.calculateStatus = function(value) {
  // CRITICAL: Null/undefined values must be rejected with validation error
  // This should never be reached if validatePhysicalLimits() was called first
  if (value === null || value === undefined || value === '') {
    throw new Error(`${this.name}: Value is required. Missing or empty values must be rejected.`);
  }

  switch (this.type) {
    case 'RANGE':
      return this.calculateRangeStatus(parseFloat(value));
    case 'MAX':
      return this.calculateMaxStatus(parseFloat(value));
    case 'ENUM':
      return this.calculateEnumStatus(value);
    case 'TEXT':
      return 'ACCEPTABLE'; // Text type always returns ACCEPTABLE (informational only)
    default:
      return 'ACCEPTABLE';
  }
};

/**
 * RANGE Logic
 * ACCEPTABLE: within acceptableLimit range
 * PERMISSIBLE: within permissibleLimit range (but outside acceptable)
 * NOT_ACCEPTABLE: outside both ranges
 */
parameterMasterSchema.methods.calculateRangeStatus = function(value) {
  const acceptable = this.acceptableLimit;
  const permissible = this.permissibleLimit;

  // Check acceptable range first
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
 * PERMISSIBLE: value <= permissibleLimit.max (but > acceptable)
 * NOT_ACCEPTABLE: value > permissibleLimit.max
 */
parameterMasterSchema.methods.calculateMaxStatus = function(value) {
  const acceptable = this.acceptableLimit;
  const permissible = this.permissibleLimit;

  // Use maxValue if acceptableLimit not set (backward compatibility)
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
 * ENUM Logic - Uses enumEvaluation mapping
 * Returns status directly from the mapping
 *
 * IMPORTANT: validatePhysicalLimits() must be called first to validate the enum value exists.
 * This method throws errors for invalid values as a defensive measure.
 */
parameterMasterSchema.methods.calculateEnumStatus = function(value) {
  // CRITICAL: No enumEvaluation configured - this is a configuration error
  if (!this.enumEvaluation || this.enumEvaluation.size === 0) {
    throw new Error(`${this.name}: No enumEvaluation configured for ENUM parameter`);
  }

  const normalizedValue = value.toString().trim();

  // Find matching key (case-insensitive)
  for (const [key, status] of this.enumEvaluation) {
    if (key.toLowerCase() === normalizedValue.toLowerCase()) {
      return status;
    }
  }

  // CRITICAL: Value not found in enumEvaluation - this is invalid input
  // This should never be reached if validatePhysicalLimits() was called first
  const validValues = Array.from(this.enumEvaluation.keys()).join(', ');
  throw new Error(`${this.name}: Invalid value "${value}". Must be one of: ${validValues}`);
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
      if (permMax !== null && permMax !== undefined) {
        return `Acceptable: ≤${accMax}, Permissible: ≤${permMax}`;
      }
      return `≤ ${accMax}`;
    case 'ENUM':
      const keys = this.getEnumKeys();
      return keys.join(', ');
    case 'TEXT':
      return 'Free text';
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
    testLocation: this.testLocation, // FIELD or LAB
    acceptableLimit: this.acceptableLimit,
    permissibleLimit: this.permissibleLimit,
    physicalLimit: this.physicalLimit,
    maxValue: this.maxValue,
    enumEvaluation: this.enumEvaluation ? Object.fromEntries(this.enumEvaluation) : {},
    testMethod: this.testMethod,
    affectsOverall: this.affectsOverall !== false // default true
  };
};

/**
 * Convert enumEvaluation to plain object for JSON serialization
 */
parameterMasterSchema.methods.toJSON = function() {
  const obj = this.toObject();
  if (obj.enumEvaluation instanceof Map) {
    obj.enumEvaluation = Object.fromEntries(obj.enumEvaluation);
  }
  return obj;
};

module.exports = mongoose.model('ParameterMaster', parameterMasterSchema);
