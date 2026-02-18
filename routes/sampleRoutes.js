/**
 * Sample Routes (Admin)
 * API endpoints for admin sample management
 *
 * NEW WORKFLOW: FIELD + LAB Hybrid Testing
 * - Lab test → FIELD_TESTED → LAB_TESTED (Admin)
 * - Publish → LAB_TESTED → PUBLISHED (Admin)
 * - Archive → PUBLISHED → ARCHIVED (Admin)
 * - Restore → ARCHIVED → PUBLISHED (Admin)
 *
 * Lifecycle: COLLECTED → FIELD_TESTED → LAB_TESTED → PUBLISHED → ARCHIVED
 */

const express = require('express');
const router = express.Router();
const sampleController = require('../controllers/sampleController');
const { protect, authorize, validate } = require('../middleware');
const { sampleValidators, paginationValidators } = require('../utils/validators');

// Stats route (Admin only)
router.get('/stats', protect, authorize('ADMIN'), sampleController.getStats);

// Get all samples
router.get(
  '/',
  protect,
  validate(paginationValidators),
  sampleController.getAllSamples
);

// Get sample by ID
router.get(
  '/:id',
  protect,
  validate(sampleValidators.getById),
  sampleController.getSampleById
);

// Submit LAB test - FIELD_TESTED → LAB_TESTED (Admin only)
router.post(
  '/:id/lab-test',
  protect,
  authorize('ADMIN'),
  validate(sampleValidators.labTest),
  sampleController.submitLabTest
);

// Publish sample - LAB_TESTED → PUBLISHED (Admin only)
router.patch(
  '/:id/publish',
  protect,
  authorize('ADMIN'),
  validate(sampleValidators.getById),
  sampleController.publishSample
);

// Archive sample - PUBLISHED → ARCHIVED (Admin only)
router.patch(
  '/:id/archive',
  protect,
  authorize('ADMIN'),
  validate(sampleValidators.getById),
  sampleController.archiveSample
);

// Restore archived sample - ARCHIVED → PUBLISHED (Admin only)
router.patch(
  '/:id/restore',
  protect,
  authorize('ADMIN'),
  validate(sampleValidators.getById),
  sampleController.restoreSample
);

module.exports = router;
