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
  ]
};

const sampleValidators = {
  create: [
    body('address')
      .trim()
      .notEmpty().withMessage('Address is required')
      .isLength({ max: 500 }).withMessage('Address cannot exceed 500 characters'),
    body('location.latitude')
      .notEmpty().withMessage('Latitude is required')
      .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    body('location.longitude')
      .notEmpty().withMessage('Longitude is required')
      .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
    body('collectedAt')
      .optional()
      .isISO8601().withMessage('collectedAt must be a valid date'),
    // Optional parameters - if provided, sample auto-publishes with results
    body('parameters')
      .optional()
      .isArray().withMessage('Parameters must be an array'),
    body('parameters.*.parameterRef')
      .optional()
      .isMongoId().withMessage('Invalid parameter reference'),
    body('parameters.*.value')
      .optional()
      .notEmpty().withMessage('Parameter value is required')
  ],
  analyse: [
    param('id')
      .isMongoId().withMessage('Invalid sample ID'),
    body('parameters')
      .isArray({ min: 1 }).withMessage('At least one parameter is required'),
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
    body('enumValues')
      .optional()
      .isArray().withMessage('enumValues must be an array'),
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
      .isIn(['RANGE', 'MAX', 'ENUM', 'TEXT']).withMessage('Type must be one of: RANGE, MAX, ENUM, TEXT')
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
