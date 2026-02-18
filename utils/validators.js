const { body, param, query } = require('express-validator');
const { userRoles } = require('../config');

const authValidators = {
  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
  ],
  createUser: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role')
      .notEmpty().withMessage('Role is required')
      .isIn(userRoles).withMessage(`Role must be one of: ${userRoles.join(', ')}`)
  ],
  updateProfile: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('email')
      .optional()
      .trim()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('password')
      .optional()
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ]
};

const sampleValidators = {
  // Mobile create - SIMPLIFIED API
  create: [
    body('title')
      .trim()
      .notEmpty().withMessage('Sample title is required')
      .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
    body('address')
      .optional()  // Address is OPTIONAL (we have lat/long)
      .trim()
      .isLength({ max: 500 }).withMessage('Address cannot exceed 500 characters'),
    body('location')
      .notEmpty().withMessage('Location is required'),
    body('collectedAt')
      .optional()
      .isISO8601().withMessage('collectedAt must be a valid date')
  ],
  // LAB test - FIELD_TESTED → LAB_TESTED (Admin only)
  labTest: [
    param('id')
      .isMongoId().withMessage('Invalid sample ID'),
    body('parameters')
      .isArray({ min: 1 }).withMessage('At least one LAB parameter is required'),
    body('parameters.*.parameterRef')
      .notEmpty().withMessage('Parameter reference is required')
      .isMongoId().withMessage('Invalid parameter reference'),
    body('parameters.*.value')
      .notEmpty().withMessage('Parameter value is required')
  ],
  getById: [
    param('id')
      .isMongoId().withMessage('Invalid sample ID')
  ]
};

const userValidators = {
  updateStatus: [
    param('id')
      .isMongoId().withMessage('Invalid user ID'),
    body('isActive')
      .notEmpty().withMessage('isActive status is required')
      .isBoolean().withMessage('isActive must be a boolean')
  ],
  getById: [
    param('id')
      .isMongoId().withMessage('Invalid user ID')
  ]
};

// Custom validator for nullable numbers
const isNullableNumber = (value) => {
  if (value === null || value === undefined) return true;
  return !isNaN(parseFloat(value)) && isFinite(value);
};

const parameterValidators = {
  create: [
    body('code')
      .trim()
      .notEmpty().withMessage('Parameter code is required')
      .toUpperCase(),
    body('name')
      .trim()
      .notEmpty().withMessage('Parameter name is required'),
    body('unit')
      .trim()
      .notEmpty().withMessage('Unit is required'),
    body('type')
      .notEmpty().withMessage('Type is required')
      .toUpperCase()
      .isIn(['RANGE', 'MAX', 'ENUM', 'TEXT']).withMessage('Type must be one of: RANGE, MAX, ENUM, TEXT'),
    // NEW: testLocation - FIELD or LAB
    body('testLocation')
      .notEmpty().withMessage('Test location is required')
      .toUpperCase()
      .isIn(['FIELD', 'LAB']).withMessage('testLocation must be FIELD or LAB'),
    body('acceptableLimit')
      .optional(),
    body('acceptableLimit.min')
      .optional({ nullable: true })
      .custom(isNullableNumber).withMessage('acceptableLimit.min must be a number or null'),
    body('acceptableLimit.max')
      .optional({ nullable: true })
      .custom(isNullableNumber).withMessage('acceptableLimit.max must be a number or null'),
    body('permissibleLimit')
      .optional(),
    body('permissibleLimit.min')
      .optional({ nullable: true })
      .custom(isNullableNumber).withMessage('permissibleLimit.min must be a number or null'),
    body('permissibleLimit.max')
      .optional({ nullable: true })
      .custom(isNullableNumber).withMessage('permissibleLimit.max must be a number or null'),
    // enumEvaluation for ENUM types: { "value": "STATUS" }
    body('enumEvaluation')
      .optional()
      .isObject().withMessage('enumEvaluation must be an object'),
    body('affectsOverall')
      .optional()
      .isBoolean().withMessage('affectsOverall must be a boolean'),
    body('testMethod')
      .optional()
      .trim()
  ],
  update: [
    param('id')
      .isMongoId().withMessage('Invalid parameter ID'),
    body('code')
      .optional()
      .trim()
      .toUpperCase(),
    body('name')
      .optional()
      .trim()
      .notEmpty().withMessage('Parameter name cannot be empty'),
    body('type')
      .optional()
      .toUpperCase()
      .isIn(['RANGE', 'MAX', 'ENUM', 'TEXT']).withMessage('Type must be one of: RANGE, MAX, ENUM, TEXT'),
    body('testLocation')
      .optional()
      .toUpperCase()
      .isIn(['FIELD', 'LAB']).withMessage('testLocation must be FIELD or LAB')
  ]
};

const paginationValidators = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
];

module.exports = {
  authValidators,
  sampleValidators,
  userValidators,
  parameterValidators,
  paginationValidators
};
