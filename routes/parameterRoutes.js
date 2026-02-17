const express = require('express');
const router = express.Router();
const { parameterController } = require('../controllers');
const { protect, authorize, validate } = require('../middleware');
const { parameterValidators } = require('../utils/validators');

// Get all parameters (authenticated users)
router.get('/', protect, parameterController.getAllParameters);

// Get parameter by ID
router.get('/:id', protect, parameterController.getParameterById);

// Create parameter (Admin only)
router.post(
  '/',
  protect,
  authorize('ADMIN'),
  validate(parameterValidators.create),
  parameterController.createParameter
);

// Update parameter (Admin only)
router.patch(
  '/:id',
  protect,
  authorize('ADMIN'),
  validate(parameterValidators.update),
  parameterController.updateParameter
);

// Toggle parameter status (Admin only)
router.patch(
  '/:id/toggle',
  protect,
  authorize('ADMIN'),
  parameterController.toggleParameterStatus
);

module.exports = router;
