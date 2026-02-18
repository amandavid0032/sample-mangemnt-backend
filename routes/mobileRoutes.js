/**
 * Mobile Routes
 * API endpoints for mobile team member app
 *
 * SINGLE API DESIGN:
 * POST /mobile/samples - Create sample with optional field test
 *   - Without parameters: COLLECTED (test later)
 *   - With parameters: FIELD_TESTED (done)
 *
 * Lifecycle: COLLECTED → FIELD_TESTED → LAB_TESTED → PUBLISHED → ARCHIVED
 */

const express = require('express');
const router = express.Router();
const mobileController = require('../controllers/mobileController');
const { protect, authorize, validate } = require('../middleware');
const { sampleValidators, paginationValidators } = require('../utils/validators');
const { sampleUpload } = require('../services/uploadService');

// All mobile routes require TEAM_MEMBER or ADMIN role
router.use(protect, authorize('TEAM_MEMBER', 'ADMIN'));

// Get FIELD parameters for form
router.get('/parameters', mobileController.getFieldParameters);

// Create sample (with optional field test values)
// Single endpoint handles both create-only and create+test
router.post(
  '/samples',
  sampleUpload,
  validate(sampleValidators.create),
  mobileController.createSample
);

// Get samples (COLLECTED by default for field testing)
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

module.exports = router;
