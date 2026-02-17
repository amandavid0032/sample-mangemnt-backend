const express = require('express');
const router = express.Router();
const mobileController = require('../controllers/mobileController');
const { protect, authorize, validate } = require('../middleware');
const { sampleValidators, paginationValidators } = require('../utils/validators');

// All mobile routes require TEAM_MEMBER role
router.use(protect, authorize('TEAM_MEMBER'));

// Get all parameters for form
router.get('/parameters', mobileController.getParameters);

// Get available samples (CREATED for all, ACCEPTED/ANALYSED for own)
router.get(
  '/samples',
  validate(paginationValidators),
  mobileController.getMobileSamples
);

// Get sample by ID
router.get(
  '/samples/:id',
  validate(sampleValidators.getById),
  mobileController.getMobileSampleById
);

// Accept sample
router.patch(
  '/samples/:id/accept',
  validate(sampleValidators.getById),
  mobileController.acceptMobileSample
);

// Submit sample with parameters
router.post(
  '/samples/:id/submit',
  validate(sampleValidators.analyse),
  mobileController.submitMobileSample
);

module.exports = router;
