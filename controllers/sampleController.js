/**
 * Sample Controller
 * Handles admin API endpoints for sample management
 *
 * NEW WORKFLOW: FIELD + LAB Hybrid Testing
 * - ADMIN submits LAB test (FIELD_TESTED → LAB_TESTED)
 * - ADMIN publishes (LAB_TESTED → PUBLISHED)
 * - ADMIN archives (PUBLISHED → ARCHIVED)
 * - ADMIN restores (ARCHIVED → PUBLISHED)
 *
 * Lifecycle: COLLECTED → FIELD_TESTED → LAB_TESTED → PUBLISHED → ARCHIVED
 */

const { Sample, AuditLog, ParameterMaster } = require('../models');
const StatusEngine = require('../services/statusEngine');
const ApiResponse = require('../utils/ApiResponse');

/**
 * Get all samples with filtering and pagination
 * GET /api/samples
 */
const getAllSamples = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      lifecycleStatus,
      overallStatus,
      search,
      includeDeleted = 'false'
    } = req.query;

    const query = {};

    // Filter out deleted by default
    if (includeDeleted !== 'true') {
      query.isDeleted = false;
    }

    if (lifecycleStatus) {
      query.lifecycleStatus = lifecycleStatus;
    }

    if (overallStatus) {
      query.overallStatus = overallStatus;
    }

    if (search) {
      query.$or = [
        { address: { $regex: search, $options: 'i' } },
        { sampleId: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [samples, total] = await Promise.all([
      Sample.find(query)
        .populate('collectedBy', 'name email')
        .populate('fieldTestedBy', 'name email')
        .populate('labTestedBy', 'name email')
        .populate('publishedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Sample.countDocuments(query)
    ]);

    res.json(
      ApiResponse.paginated(samples, {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }, 'Samples retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get sample by ID
 * GET /api/samples/:id
 */
const getSampleById = async (req, res, next) => {
  try {
    const sample = await Sample.findById(req.params.id)
      .populate('collectedBy', 'name email')
      .populate('fieldTestedBy', 'name email')
      .populate('labTestedBy', 'name email')
      .populate('publishedBy', 'name email');

    if (!sample) {
      return res.status(404).json(
        ApiResponse.error('Sample not found', 404)
      );
    }

    res.json(ApiResponse.success(sample, 'Sample retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Submit LAB test - FIELD_TESTED → LAB_TESTED
 * POST /api/samples/:id/lab-test
 *
 * SECURITY:
 * - Only ADMIN can submit lab test
 * - Only LAB parameters allowed
 * - Sample must be in FIELD_TESTED status
 * - Calculates overall status after merging with FIELD results
 */
const submitLabTest = async (req, res, next) => {
  try {
    const { parameters } = req.body;
    const sample = await Sample.findById(req.params.id);

    if (!sample) {
      return res.status(404).json(
        ApiResponse.error('Sample not found', 404)
      );
    }

    if (sample.isDeleted) {
      return res.status(400).json(
        ApiResponse.error('Cannot submit test for a deleted sample', 400)
      );
    }

    // SECURITY: Only FIELD_TESTED samples can have lab test submitted
    if (sample.lifecycleStatus !== 'FIELD_TESTED') {
      return res.status(400).json(
        ApiResponse.error(`Sample must be in FIELD_TESTED status. Current status: ${sample.lifecycleStatus}`, 400)
      );
    }

    // Get existing FIELD parameters from sample
    const existingFieldParams = sample.getFieldParameters();

    // Process LAB test using StatusEngine
    // This validates only LAB parameters are submitted and all are present
    // Also merges with FIELD parameters and calculates overall status
    const labResult = await StatusEngine.processLabTest(parameters, existingFieldParams);

    const now = new Date();

    // Update sample with LAB test results (includes FIELD + LAB params)
    sample.parameters = labResult.parameters;
    sample.overallStatus = labResult.overallStatus;
    sample.lifecycleStatus = 'LAB_TESTED';
    sample.labTestedBy = req.user._id;
    sample.labTestedAt = now;

    await sample.save();

    // Log action
    await AuditLog.logAction({
      action: 'SAMPLE_LAB_TESTED',
      performedBy: req.user._id,
      sampleRef: sample._id,
      details: {
        labParametersCount: parameters.length,
        totalParametersCount: labResult.parameters.length,
        overallStatus: labResult.overallStatus,
        statusSummary: StatusEngine.getStatusSummary(labResult.parameters)
      },
      ipAddress: req.ip
    });

    const populatedSample = await Sample.findById(sample._id)
      .populate('collectedBy', 'name email')
      .populate('fieldTestedBy', 'name email')
      .populate('labTestedBy', 'name email');

    res.json(ApiResponse.success(populatedSample, 'Lab test submitted successfully. Ready for publishing.'));
  } catch (error) {
    // Handle validation errors from StatusEngine
    if (error.validationErrors) {
      return res.status(400).json(
        ApiResponse.error('Validation failed', 400, error.validationErrors)
      );
    }
    next(error);
  }
};

/**
 * Publish sample - LAB_TESTED → PUBLISHED
 * PATCH /api/samples/:id/publish
 *
 * Publishing allowed even if overallStatus = NOT_ACCEPTABLE
 */
const publishSample = async (req, res, next) => {
  try {
    const sample = await Sample.findById(req.params.id);

    if (!sample) {
      return res.status(404).json(
        ApiResponse.error('Sample not found', 404)
      );
    }

    if (sample.isDeleted) {
      return res.status(400).json(
        ApiResponse.error('Cannot publish a deleted sample', 400)
      );
    }

    // Must be LAB_TESTED to publish
    if (sample.lifecycleStatus !== 'LAB_TESTED') {
      return res.status(400).json(
        ApiResponse.error(`Sample must be in LAB_TESTED status. Current status: ${sample.lifecycleStatus}`, 400)
      );
    }

    const now = new Date();

    sample.lifecycleStatus = 'PUBLISHED';
    sample.publishedBy = req.user._id;
    sample.publishedAt = now;

    await sample.save();

    // Log action
    await AuditLog.logAction({
      action: 'SAMPLE_PUBLISHED',
      performedBy: req.user._id,
      sampleRef: sample._id,
      details: {
        overallStatus: sample.overallStatus,
        parametersCount: sample.parameters.length
      },
      ipAddress: req.ip
    });

    const populatedSample = await Sample.findById(sample._id)
      .populate('collectedBy', 'name email')
      .populate('fieldTestedBy', 'name email')
      .populate('labTestedBy', 'name email')
      .populate('publishedBy', 'name email');

    res.json(ApiResponse.success(populatedSample, 'Sample published successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Archive sample (soft delete) - PUBLISHED → ARCHIVED
 * PATCH /api/samples/:id/archive
 */
const archiveSample = async (req, res, next) => {
  try {
    const sample = await Sample.findById(req.params.id);

    if (!sample) {
      return res.status(404).json(
        ApiResponse.error('Sample not found', 404)
      );
    }

    if (sample.isDeleted) {
      return res.status(400).json(
        ApiResponse.error('Sample is already archived', 400)
      );
    }

    // Only PUBLISHED samples can be archived
    if (sample.lifecycleStatus !== 'PUBLISHED') {
      return res.status(400).json(
        ApiResponse.error(`Sample must be in PUBLISHED status to archive. Current status: ${sample.lifecycleStatus}`, 400)
      );
    }

    const previousStatus = sample.lifecycleStatus;
    sample.archive();
    await sample.save();

    // Log action
    await AuditLog.logAction({
      action: 'SAMPLE_ARCHIVED',
      performedBy: req.user._id,
      sampleRef: sample._id,
      details: { previousStatus },
      ipAddress: req.ip
    });

    res.json(ApiResponse.success(sample, 'Sample archived successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Restore archived sample - ARCHIVED → PUBLISHED
 * PATCH /api/samples/:id/restore
 */
const restoreSample = async (req, res, next) => {
  try {
    const sample = await Sample.findById(req.params.id);

    if (!sample) {
      return res.status(404).json(
        ApiResponse.error('Sample not found', 404)
      );
    }

    if (!sample.isDeleted) {
      return res.status(400).json(
        ApiResponse.error('Sample is not archived', 400)
      );
    }

    sample.restore();
    await sample.save();

    // Log action
    await AuditLog.logAction({
      action: 'SAMPLE_RESTORED',
      performedBy: req.user._id,
      sampleRef: sample._id,
      details: { restoredTo: sample.lifecycleStatus },
      ipAddress: req.ip
    });

    res.json(ApiResponse.success(sample, 'Sample restored successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get LAB parameters for admin form
 * GET /api/parameters?type=LAB
 */
const getLabParameters = async (req, res, next) => {
  try {
    const parameters = await StatusEngine.getLabParameters();

    res.json(ApiResponse.success(parameters, 'LAB parameters retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get sample statistics - ADMIN only
 * GET /api/samples/stats
 */
const getStats = async (req, res, next) => {
  try {
    const baseQuery = { isDeleted: false };

    const [lifecycleStats, overallStats, monthlyTrend, archivedCount] = await Promise.all([
      Sample.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$lifecycleStatus', count: { $sum: 1 } } }
      ]),
      Sample.aggregate([
        { $match: { ...baseQuery, overallStatus: { $ne: null } } },
        { $group: { _id: '$overallStatus', count: { $sum: 1 } } }
      ]),
      Sample.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ]),
      Sample.countDocuments({ isDeleted: true })
    ]);

    const total = await Sample.countDocuments(baseQuery);

    const stats = {
      total,
      archived: archivedCount,
      byLifecycle: {
        COLLECTED: 0,
        FIELD_TESTED: 0,
        LAB_TESTED: 0,
        PUBLISHED: 0
      },
      byOverallStatus: {
        ACCEPTABLE: 0,
        PERMISSIBLE: 0,
        NOT_ACCEPTABLE: 0
      },
      monthlyTrend: monthlyTrend.map(m => ({
        year: m._id.year,
        month: m._id.month,
        count: m.count
      }))
    };

    lifecycleStats.forEach(stat => {
      if (stats.byLifecycle[stat._id] !== undefined) {
        stats.byLifecycle[stat._id] = stat.count;
      }
    });

    overallStats.forEach(stat => {
      if (stats.byOverallStatus[stat._id] !== undefined) {
        stats.byOverallStatus[stat._id] = stat.count;
      }
    });

    res.json(ApiResponse.success(stats, 'Statistics retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSamples,
  getSampleById,
  submitLabTest,
  publishSample,
  archiveSample,
  restoreSample,
  getLabParameters,
  getStats
};
