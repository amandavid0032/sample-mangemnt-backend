const express = require('express');
const router = express.Router();
const { sampleController } = require('../controllers');
const { protect, authorize, validate } = require('../middleware');
const { sampleValidators, paginationValidators } = require('../utils/validators');
const { sampleUpload } = require('../services/uploadService');

// Debug route - check database counts (temporary)
router.get('/debug', async (req, res) => {
  try {
    const Sample = require('../models').Sample;
    const ParameterMaster = require('../models').ParameterMaster;
    const User = require('../models').User;

    const [
      totalSamples,
      testingCount,
      publishedCount,
      archivedCount,
      parameterCount,
      userCount
    ] = await Promise.all([
      Sample.countDocuments({ isDeleted: false }),
      Sample.countDocuments({ lifecycleStatus: 'TESTING', isDeleted: false }),
      Sample.countDocuments({ lifecycleStatus: 'PUBLISHED', isDeleted: false }),
      Sample.countDocuments({ isDeleted: true }),
      ParameterMaster.countDocuments(),
      User.countDocuments()
    ]);

    // Get sample details
    const samples = await Sample.find({}).select('sampleId lifecycleStatus overallStatus address isDeleted').limit(20);

    res.json({
      success: true,
      debug: {
        users: userCount,
        parameters: parameterCount,
        samples: {
          total: totalSamples,
          TESTING: testingCount,
          PUBLISHED: publishedCount,
          ARCHIVED: archivedCount
        },
        sampleList: samples
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stats route (Admin only)
router.get('/stats', protect, authorize('ADMIN'), sampleController.getStats);

// Create sample (Team Member or Admin) - starts in TESTING status
router.post(
  '/',
  protect,
  authorize('TEAM_MEMBER', 'ADMIN'),
  sampleUpload,
  validate(sampleValidators.create),
  sampleController.createSample
);

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

// Submit analysis - AUTO-CALCULATES and AUTO-PUBLISHES (Team Member or Admin)
router.post(
  '/:id/submit',
  protect,
  authorize('TEAM_MEMBER', 'ADMIN'),
  validate(sampleValidators.analyse),
  sampleController.submitSample
);

// Archive sample - soft delete (Admin only)
router.patch(
  '/:id/archive',
  protect,
  authorize('ADMIN'),
  validate(sampleValidators.getById),
  sampleController.archiveSample
);

// Restore archived sample (Admin only)
router.patch(
  '/:id/restore',
  protect,
  authorize('ADMIN'),
  validate(sampleValidators.getById),
  sampleController.restoreSample
);

module.exports = router;
