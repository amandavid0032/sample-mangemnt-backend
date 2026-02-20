/**
 * Sample Controller
 * Handles admin API endpoints for sample management
 *
 * NEW DESIGN:
 * - Uses testInfo nested object for tracking test status
 * - Status calculation happens ONLY after LAB test
 */

const { Sample, AuditLog, ParameterMaster } = require('../models');
const ApiResponse = require('../utils/ApiResponse');
const { generateSampleReport } = require('../services/reportService');

/**
 * Get all samples with filtering and pagination
 * GET /api/samples
 */
const getAllSamples = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      fieldTested,
      labTested,
      published,
      overallStatus,
      search,
      includeDeleted = 'false'
    } = req.query;

    const query = {};

    // Filter out deleted by default
    if (includeDeleted !== 'true') {
      query.isDeleted = false;
    }

    // Filter by testInfo flags
    if (fieldTested !== undefined) {
      query['testInfo.fieldTested'] = fieldTested === 'true';
    }
    if (labTested !== undefined) {
      query['testInfo.labTested'] = labTested === 'true';
    }
    if (published !== undefined) {
      query['testInfo.published'] = published === 'true';
    }

    if (overallStatus) {
      query.overallStatus = overallStatus;
    }

    if (search) {
      query.$or = [
        { address: { $regex: search, $options: 'i' } },
        { sampleId: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [samples, total] = await Promise.all([
      Sample.find(query)
        .populate('collectedBy', 'name email')
        .populate('testInfo.labTestedBy', 'name email')
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
      .populate('testInfo.labTestedBy', 'name email');

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
 * Submit LAB test
 * POST /api/samples/:id/lab-test
 *
 * - Only samples with fieldTested=true, labTested=false can have LAB test
 * - Calculates status for ALL parameters (FIELD + LAB)
 * - Sets overallStatus
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

    // Must be field tested but not lab tested
    if (!sample.testInfo.fieldTested) {
      return res.status(400).json(
        ApiResponse.error('Sample must have FIELD test completed first', 400)
      );
    }

    if (sample.testInfo.labTested) {
      return res.status(400).json(
        ApiResponse.error('LAB test already submitted for this sample', 400)
      );
    }

    // Validate LAB parameters
    if (!parameters || parameters.length === 0) {
      return res.status(400).json(
        ApiResponse.error('LAB parameters are required', 400)
      );
    }

    // Get LAB parameter definitions
    const labParamIds = parameters.map(p => p.parameterRef);
    const labParamDocs = await ParameterMaster.find({
      _id: { $in: labParamIds },
      testLocation: 'LAB',
      isActive: true
    });

    if (labParamDocs.length !== labParamIds.length) {
      const validIds = labParamDocs.map(p => p._id.toString());
      const invalidIds = labParamIds.filter(id => !validIds.includes(id));
      return res.status(400).json(
        ApiResponse.error(`Invalid LAB parameter IDs: ${invalidIds.join(', ')}`, 400)
      );
    }

    const now = new Date();

    // Get existing FIELD parameters
    const fieldParams = sample.parameters;

    // Process LAB parameters - create snapshots with status
    const labParamsWithStatus = [];
    for (const input of parameters) {
      const paramMaster = labParamDocs.find(p => p._id.toString() === input.parameterRef);

      // Calculate status
      const status = paramMaster.calculateStatus(input.value);

      labParamsWithStatus.push({
        parameterRef: paramMaster._id,
        code: paramMaster.code,
        name: paramMaster.name,
        unit: paramMaster.unit,
        type: paramMaster.type,
        testLocation: 'LAB',
        acceptableLimit: {
          min: paramMaster.acceptableLimit?.min ?? null,
          max: paramMaster.acceptableLimit?.max ?? null
        },
        permissibleLimit: {
          min: paramMaster.permissibleLimit?.min ?? null,
          max: paramMaster.permissibleLimit?.max ?? null
        },
        value: input.value,
        status: status
      });
    }

    // Also calculate status for FIELD parameters now
    const fieldParamIds = fieldParams.map(p => p.parameterRef.toString());
    const fieldParamDocs = await ParameterMaster.find({
      _id: { $in: fieldParamIds },
      isActive: true
    });

    const fieldParamsWithStatus = fieldParams.map(fp => {
      const paramMaster = fieldParamDocs.find(p => p._id.toString() === fp.parameterRef.toString());
      if (paramMaster) {
        // Use try-catch because old samples might have invalid values
        let status = null;
        try {
          status = paramMaster.calculateStatus(fp.value);
        } catch {
          // If status calculation fails (e.g., invalid ENUM value), use existing status or ACCEPTABLE
          status = fp.status || 'ACCEPTABLE';
        }

        return {
          ...fp.toObject(),
          code: paramMaster.code,
          name: paramMaster.name,
          unit: paramMaster.unit,
          type: paramMaster.type,
          acceptableLimit: {
            min: paramMaster.acceptableLimit?.min ?? null,
            max: paramMaster.acceptableLimit?.max ?? null
          },
          permissibleLimit: {
            min: paramMaster.permissibleLimit?.min ?? null,
            max: paramMaster.permissibleLimit?.max ?? null
          },
          status: status
        };
      }
      // If no paramMaster found, keep existing data with existing status or null
      const fpObj = typeof fp.toObject === 'function' ? fp.toObject() : fp;
      return {
        ...fpObj,
        status: fpObj.status || null
      };
    });

    // Merge FIELD + LAB parameters
    const allParameters = [...fieldParamsWithStatus, ...labParamsWithStatus];

    // Calculate overall status
    const overallStatus = calculateOverallStatus(allParameters);

    // Update sample
    sample.parameters = allParameters;
    sample.overallStatus = overallStatus;
    sample.testInfo.labTested = true;
    sample.testInfo.labTestedBy = req.user._id;
    sample.testInfo.labTestedAt = now;

    // Auto-publish after LAB test
    sample.testInfo.published = true;
    sample.testInfo.publishedAt = now;

    await sample.save();

    // Log action
    await AuditLog.logAction({
      action: 'SAMPLE_LAB_TESTED_AND_PUBLISHED',
      performedBy: req.user._id,
      sampleRef: sample._id,
      details: {
        labParametersCount: parameters.length,
        totalParametersCount: allParameters.length,
        overallStatus: overallStatus,
        autoPublished: true
      },
      ipAddress: req.ip
    });

    const populatedSample = await Sample.findById(sample._id)
      .populate('collectedBy', 'name email')
      .populate('testInfo.labTestedBy', 'name email');

    res.json(ApiResponse.success(populatedSample, 'Lab test submitted and sample published successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate overall status from parameters
 */
function calculateOverallStatus(parameters) {
  if (!parameters || parameters.length === 0) return null;

  const affectingParams = parameters.filter(p => p.affectsOverall !== false && p.status);

  if (affectingParams.length === 0) return 'ACCEPTABLE';

  if (affectingParams.some(p => p.status === 'NOT_ACCEPTABLE')) return 'NOT_ACCEPTABLE';
  if (affectingParams.some(p => p.status === 'PERMISSIBLE')) return 'PERMISSIBLE';

  return 'ACCEPTABLE';
}

/**
 * Publish sample
 * PATCH /api/samples/:id/publish
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

    // Must have LAB test completed
    if (!sample.testInfo.labTested) {
      return res.status(400).json(
        ApiResponse.error('Sample must have LAB test completed before publishing', 400)
      );
    }

    if (sample.testInfo.published) {
      return res.status(400).json(
        ApiResponse.error('Sample is already published', 400)
      );
    }

    const now = new Date();

    sample.testInfo.published = true;
    sample.testInfo.publishedAt = now;

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
      .populate('testInfo.labTestedBy', 'name email');

    res.json(ApiResponse.success(populatedSample, 'Sample published successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Archive sample (soft delete)
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

    // Only published samples can be archived
    if (!sample.testInfo.published) {
      return res.status(400).json(
        ApiResponse.error('Sample must be published before archiving', 400)
      );
    }

    sample.isDeleted = true;
    await sample.save();

    // Log action
    await AuditLog.logAction({
      action: 'SAMPLE_ARCHIVED',
      performedBy: req.user._id,
      sampleRef: sample._id,
      details: {},
      ipAddress: req.ip
    });

    res.json(ApiResponse.success(sample, 'Sample archived successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Restore archived sample
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

    sample.isDeleted = false;
    await sample.save();

    // Log action
    await AuditLog.logAction({
      action: 'SAMPLE_RESTORED',
      performedBy: req.user._id,
      sampleRef: sample._id,
      details: {},
      ipAddress: req.ip
    });

    res.json(ApiResponse.success(sample, 'Sample restored successfully'));
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

    const [testStats, overallStats, monthlyTrend, archivedCount, total] = await Promise.all([
      // Count by test status
      Sample.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: {
              fieldTested: '$testInfo.fieldTested',
              labTested: '$testInfo.labTested',
              published: '$testInfo.published'
            },
            count: { $sum: 1 }
          }
        }
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
      Sample.countDocuments({ isDeleted: true }),
      Sample.countDocuments(baseQuery)
    ]);

    // Calculate counts based on testInfo
    let fieldTestedOnly = 0;
    let labTested = 0;
    let published = 0;

    testStats.forEach(stat => {
      if (stat._id.published) {
        published += stat.count;
      } else if (stat._id.labTested) {
        labTested += stat.count;
      } else if (stat._id.fieldTested) {
        fieldTestedOnly += stat.count;
      }
    });

    const stats = {
      total,
      archived: archivedCount,
      byStatus: {
        fieldTestedOnly,
        labTested,
        published
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

/**
 * Download sample as PDF report
 * GET /api/samples/:id/pdf
 */
const downloadPDF = async (req, res, next) => {
  try {
    const sample = await Sample.findById(req.params.id)
      .populate('collectedBy', 'name email')
      .populate('testInfo.labTestedBy', 'name email');

    if (!sample) {
      return res.status(404).json(
        ApiResponse.error('Sample not found', 404)
      );
    }

    // Generate PDF
    const doc = generateSampleReport(sample);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${sample.sampleId}-report.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);
    doc.end();

    // Log action
    await AuditLog.logAction({
      action: 'SAMPLE_PDF_DOWNLOADED',
      performedBy: req.user._id,
      sampleRef: sample._id,
      details: { sampleId: sample.sampleId },
      ipAddress: req.ip
    });
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
  getStats,
  downloadPDF
};
