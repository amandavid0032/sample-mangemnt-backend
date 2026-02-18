/**
 * Mobile Controller
 * Handles mobile app API endpoints for field team members
 *
 * NEW DESIGN:
 * - FIELD test: Just stores {parameterRef, value} - NO status calculation
 * - Status calculation happens ONLY when admin submits LAB test
 * - Uses testInfo nested object for tracking test status
 */

const { Sample, AuditLog, ParameterMaster } = require('../models');
const ApiResponse = require('../utils/ApiResponse');
const { processUploadedFiles } = require('../services/uploadService');

/**
 * Create new sample with field test values
 * POST /api/mobile/samples
 *
 * REQUIRED:
 * - title: Sample title
 * - location: JSON {latitude, longitude}
 * - sampleImage: Water sample photo (file)
 * - locationImage: Location photo (file)
 * - parameters: [{id, value}, ...]
 *
 * OPTIONAL:
 * - address: Location address
 * - collectedAt: Collection date
 *
 * RESPONSE:
 * { sampleId, createdAt, message } or { error }
 */
const createSample = async (req, res, next) => {
  try {
    const { title, address, location, collectedAt, parameters } = req.body;

    // REQUIRED: Sample image must be uploaded
    if (!req.files || !req.files.sampleImage) {
      return res.status(400).json(
        ApiResponse.error('Sample image (sampleImage) is required', 400)
      );
    }

    // REQUIRED: Location image must be uploaded
    if (!req.files.locationImage) {
      return res.status(400).json(
        ApiResponse.error('Location image (locationImage) is required', 400)
      );
    }

    // Parse location data if string (multipart form sends as string)
    const locationData = typeof location === 'string' ? JSON.parse(location) : location;

    // Validate location coordinates
    if (!locationData || !locationData.latitude || !locationData.longitude) {
      return res.status(400).json(
        ApiResponse.error('Location with latitude and longitude is required', 400)
      );
    }

    // Parse parameters - REQUIRED (simplified format: {id, value})
    let parsedParameters = [];
    if (parameters) {
      parsedParameters = typeof parameters === 'string'
        ? JSON.parse(parameters)
        : parameters;
    }

    if (parsedParameters.length === 0) {
      return res.status(400).json(
        ApiResponse.error('parameters is required - send [{id, value}, ...]', 400)
      );
    }

    // Extract parameter IDs for validation
    const parameterIds = parsedParameters.map(p => p.id);

    // Validate all submitted parameters are FIELD parameters
    const paramDocs = await ParameterMaster.find({
      _id: { $in: parameterIds },
      testLocation: 'FIELD',
      isActive: true
    });

    if (paramDocs.length !== parameterIds.length) {
      // Some parameters are not FIELD type or don't exist
      const validIds = paramDocs.map(p => p._id.toString());
      const invalidIds = parameterIds.filter(id => !validIds.includes(id));
      return res.status(400).json(
        ApiResponse.error(`Invalid FIELD parameter IDs: ${invalidIds.join(', ')}`, 400)
      );
    }

    // Process uploaded images
    const imageUrls = processUploadedFiles(req.files);

    const now = new Date();

    // Create sample with FIELD test values (NO status calculation)
    // Store full snapshot so View modal can display parameter info
    const sampleParameters = parsedParameters.map(p => {
      const paramMaster = paramDocs.find(doc => doc._id.toString() === p.id);
      return {
        parameterRef: p.id,
        // SNAPSHOT data from ParameterMaster
        code: paramMaster.code,
        name: paramMaster.name,
        unit: paramMaster.unit,
        type: paramMaster.type,
        testLocation: 'FIELD',
        acceptableLimit: {
          min: paramMaster.acceptableLimit?.min ?? null,
          max: paramMaster.acceptableLimit?.max ?? null
        },
        permissibleLimit: {
          min: paramMaster.permissibleLimit?.min ?? null,
          max: paramMaster.permissibleLimit?.max ?? null
        },
        value: p.value,
        status: null  // Status will be calculated after LAB test
      };
    });

    const sampleData = {
      title,
      address,
      location: {
        type: 'Point',
        coordinates: [parseFloat(locationData.longitude), parseFloat(locationData.latitude)]
      },
      collectedBy: req.user._id,
      collectedAt: collectedAt || now,
      images: imageUrls,
      testInfo: {
        fieldTested: true,
        fieldTestedAt: now,
        labTested: false,
        labTestedBy: null,
        labTestedAt: null,
        published: false,
        publishedAt: null
      },
      parameters: sampleParameters,
      overallStatus: null
    };

    // Create sample
    const sample = await Sample.create(sampleData);

    // Log action
    await AuditLog.logAction({
      action: 'SAMPLE_CREATED_WITH_FIELD_TEST',
      performedBy: req.user._id,
      sampleRef: sample._id,
      details: {
        sampleId: sample.sampleId,
        title,
        parametersCount: parsedParameters.length
      },
      ipAddress: req.ip
    });

    // SIMPLIFIED RESPONSE - only essential data
    res.status(201).json({
      success: true,
      message: 'Sample created successfully',
      data: {
        sampleId: sample.sampleId,
        createdAt: sample.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get samples for mobile user (their own samples only)
 * GET /api/mobile/samples
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10)
 * - period: Time filter - 'today' | 'yesterday' | 'week' | 'month' | 'all' (default: 'all')
 * - status: Status filter - 'pending' | 'lab_done' | 'published' | 'all' (default: 'all')
 */
const getMobileSamples = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, period = 'all', status = 'all' } = req.query;

    // Base query - only show user's own samples
    const query = {
      isDeleted: false,
      collectedBy: req.user._id  // Only samples created by this user
    };

    // Time period filter
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case 'today':
        query.createdAt = { $gte: startOfToday };
        break;
      case 'yesterday':
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        query.createdAt = { $gte: startOfYesterday, $lt: startOfToday };
        break;
      case 'week':
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - 7);
        query.createdAt = { $gte: startOfWeek };
        break;
      case 'month':
        const startOfMonth = new Date(startOfToday);
        startOfMonth.setDate(startOfMonth.getDate() - 30);
        query.createdAt = { $gte: startOfMonth };
        break;
      // 'all' - no date filter
    }

    // Status filter
    switch (status) {
      case 'pending':
        // Field tested but not lab tested
        query['testInfo.fieldTested'] = true;
        query['testInfo.labTested'] = false;
        break;
      case 'lab_done':
        // Lab tested but not published
        query['testInfo.labTested'] = true;
        query['testInfo.published'] = false;
        break;
      case 'published':
        query['testInfo.published'] = true;
        break;
      // 'all' - no status filter
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [samples, total, stats] = await Promise.all([
      Sample.find(query)
        .select('sampleId title address images collectedAt testInfo overallStatus createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Sample.countDocuments(query),
      // Get counts for each period (for UI tabs)
      getMySampleStats(req.user._id)
    ]);

    res.json({
      success: true,
      message: 'Samples retrieved successfully',
      data: samples,
      stats: stats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sample statistics for current user
 * Helper function for getMobileSamples
 */
const getMySampleStats = async (userId) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfMonth = new Date(startOfToday);
  startOfMonth.setDate(startOfMonth.getDate() - 30);

  const baseQuery = { collectedBy: userId, isDeleted: false };

  const [today, yesterday, week, month, total, pending, labDone, published] = await Promise.all([
    Sample.countDocuments({ ...baseQuery, createdAt: { $gte: startOfToday } }),
    Sample.countDocuments({ ...baseQuery, createdAt: { $gte: startOfYesterday, $lt: startOfToday } }),
    Sample.countDocuments({ ...baseQuery, createdAt: { $gte: startOfWeek } }),
    Sample.countDocuments({ ...baseQuery, createdAt: { $gte: startOfMonth } }),
    Sample.countDocuments(baseQuery),
    Sample.countDocuments({ ...baseQuery, 'testInfo.fieldTested': true, 'testInfo.labTested': false }),
    Sample.countDocuments({ ...baseQuery, 'testInfo.labTested': true, 'testInfo.published': false }),
    Sample.countDocuments({ ...baseQuery, 'testInfo.published': true })
  ]);

  return {
    byPeriod: { today, yesterday, week, month, total },
    byStatus: { pending, labDone, published }
  };
};

/**
 * Get single sample by ID for mobile
 * GET /api/mobile/samples/:id
 */
const getMobileSampleById = async (req, res, next) => {
  try {
    const sample = await Sample.findOne({
      _id: req.params.id,
      isDeleted: false
    })
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
 * Get FIELD parameters for mobile form
 * GET /api/mobile/parameters
 */
const getFieldParameters = async (req, res, next) => {
  try {
    const parameters = await ParameterMaster.find({
      testLocation: 'FIELD',
      isActive: true
    }).select('_id code name unit type acceptableLimit permissibleLimit enumEvaluation').sort({ code: 1 });

    // Simplify response based on type
    const simplified = parameters.map(p => {
      const base = {
        _id: p._id,
        code: p.code,
        name: p.name,
        unit: p.unit,
        type: p.type
      };

      switch (p.type) {
        case 'ENUM':
          return {
            ...base,
            enumEvaluation: p.enumEvaluation instanceof Map
              ? Object.fromEntries(p.enumEvaluation)
              : (p.enumEvaluation || {})
          };

        case 'MAX':
          return {
            ...base,
            acceptableLimit: p.acceptableLimit?.max,
            permissibleLimit: p.permissibleLimit?.max
          };

        case 'RANGE':
          return {
            ...base,
            acceptableRange: {
              min: p.acceptableLimit?.min,
              max: p.acceptableLimit?.max
            },
            permissibleRange: {
              min: p.permissibleLimit?.min,
              max: p.permissibleLimit?.max
            }
          };

        case 'TEXT':
        default:
          return base;
      }
    });

    res.json(ApiResponse.success(simplified, 'FIELD parameters retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get my sample statistics (for mobile dashboard)
 * GET /api/mobile/stats
 *
 * Returns counts by period and status for current user
 */
const getMobileStats = async (req, res, next) => {
  try {
    const stats = await getMySampleStats(req.user._id);

    res.json(ApiResponse.success(stats, 'Statistics retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSample,
  getMobileSamples,
  getMobileSampleById,
  getFieldParameters,
  getMobileStats
};
