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
    // Just store parameterRef + value
    const sampleParameters = parsedParameters.map(p => ({
      parameterRef: p.id,
      value: p.value,
      testLocation: 'FIELD',
      status: null  // Status will be calculated after LAB test
    }));

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
 * Get samples for mobile user
 * GET /api/mobile/samples
 * Query params: page, limit, fieldTested, labTested
 */
const getMobileSamples = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, fieldTested, labTested } = req.query;

    const query = { isDeleted: false };

    // Filter by test status
    if (fieldTested !== undefined) {
      query['testInfo.fieldTested'] = fieldTested === 'true';
    }
    if (labTested !== undefined) {
      query['testInfo.labTested'] = labTested === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [samples, total] = await Promise.all([
      Sample.find(query)
        .select('sampleId title images collectedAt testInfo overallStatus')
        .populate('collectedBy', 'name')
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

module.exports = {
  createSample,
  getMobileSamples,
  getMobileSampleById,
  getFieldParameters
};
