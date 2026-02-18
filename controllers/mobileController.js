/**
 * Mobile Controller
 * Handles mobile app API endpoints for field team members
 *
 * SINGLE API DESIGN:
 * POST /mobile/samples - One endpoint for sample creation + field test
 *   - Without parameters: Creates sample in COLLECTED status
 *   - With parameters: Creates sample + runs field test → FIELD_TESTED
 *
 * Lifecycle: COLLECTED → FIELD_TESTED → LAB_TESTED → PUBLISHED → ARCHIVED
 */

const { Sample, AuditLog, ParameterMaster } = require('../models');
const StatusEngine = require('../services/statusEngine');
const ApiResponse = require('../utils/ApiResponse');
const { processUploadedFiles } = require('../services/uploadService');

/**
 * Create new sample with optional field test values
 * POST /api/mobile/samples
 *
 * REQUIRED: multipart/form-data with sampleImage
 * - title: Sample title (required)
 * - address: Location address (required)
 * - location: JSON string with latitude/longitude (required)
 * - collectedAt: Collection date (optional)
 * - selectedParameters: JSON array of parameter IDs to test (required)
 * - sampleImage: Water sample photo (required)
 * - locationImage: Location/site photo (optional)
 * - parameters: JSON array of {parameterRef, value} - OPTIONAL
 *               If provided, sample goes to FIELD_TESTED immediately
 *               If not provided, sample stays in COLLECTED (test later)
 */
const createSample = async (req, res, next) => {
  try {
    const { title, address, location, collectedAt, selectedParameters, parameters } = req.body;

    // REQUIRED: Sample image must be uploaded
    if (!req.files || !req.files.sampleImage) {
      return res.status(400).json(
        ApiResponse.error('Sample image (sampleImage) is required', 400)
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

    // Parse selectedParameters if string (REQUIRED)
    let parsedSelectedParameters = [];
    if (selectedParameters) {
      parsedSelectedParameters = typeof selectedParameters === 'string'
        ? JSON.parse(selectedParameters)
        : selectedParameters;
    }

    if (parsedSelectedParameters.length === 0) {
      return res.status(400).json(
        ApiResponse.error('selectedParameters is required - specify which parameters to test', 400)
      );
    }

    // Parse parameters (test values) if provided
    let parsedParameters = null;
    if (parameters) {
      parsedParameters = typeof parameters === 'string'
        ? JSON.parse(parameters)
        : parameters;
    }

    const now = new Date();
    const sampleData = {
      title,
      address,
      location: {
        type: 'Point',
        coordinates: [parseFloat(locationData.longitude), parseFloat(locationData.latitude)]
      },
      collectedBy: req.user._id,
      collectedAt: collectedAt || now,
      lifecycleStatus: 'COLLECTED',
      selectedParameters: parsedSelectedParameters
    };

    // Process uploaded images
    const imageUrls = processUploadedFiles(req.files);
    sampleData.images = imageUrls;

    // Create sample first
    const sample = await Sample.create(sampleData);

    let message = 'Sample created successfully';
    let actionLogged = 'SAMPLE_CREATED';

    // If parameters (values) provided, process field test immediately
    if (parsedParameters && parsedParameters.length > 0) {
      // Get selected parameters for validation
      const selectedParamDocs = await ParameterMaster.find({
        _id: { $in: parsedSelectedParameters },
        testLocation: 'FIELD',
        isActive: true
      });

      // Validate submitted parameters match selectedParameters
      const selectedFieldIds = selectedParamDocs.map(p => p._id.toString());
      const submittedIds = parsedParameters.map(p => p.parameterRef);

      // Check all selected FIELD parameters are submitted
      const missingParams = selectedFieldIds.filter(id => !submittedIds.includes(id));
      if (missingParams.length > 0) {
        const missingNames = selectedParamDocs
          .filter(p => missingParams.includes(p._id.toString()))
          .map(p => p.name);
        // Delete the created sample since validation failed
        await Sample.findByIdAndDelete(sample._id);
        return res.status(400).json(
          ApiResponse.error(`Missing required parameters: ${missingNames.join(', ')}`, 400)
        );
      }

      // Check no extra parameters
      const extraParams = submittedIds.filter(id => !selectedFieldIds.includes(id));
      if (extraParams.length > 0) {
        await Sample.findByIdAndDelete(sample._id);
        return res.status(400).json(
          ApiResponse.error('Extra parameters submitted that were not selected', 400)
        );
      }

      // Process field test
      try {
        const fieldResult = await StatusEngine.processFieldTest(parsedParameters, selectedParamDocs);

        // Update sample with field test results
        sample.parameters = fieldResult.parameters;
        sample.lifecycleStatus = 'FIELD_TESTED';
        sample.fieldTestedBy = req.user._id;
        sample.fieldTestedAt = now;
        await sample.save();

        message = 'Sample created and field test submitted successfully';
        actionLogged = 'SAMPLE_CREATED_WITH_FIELD_TEST';
      } catch (fieldError) {
        // Delete sample if field test processing fails
        await Sample.findByIdAndDelete(sample._id);
        if (fieldError.validationErrors) {
          return res.status(400).json(
            ApiResponse.error('Field test validation failed', 400, fieldError.validationErrors)
          );
        }
        throw fieldError;
      }
    }

    // Log action
    await AuditLog.logAction({
      action: actionLogged,
      performedBy: req.user._id,
      sampleRef: sample._id,
      details: {
        sampleId: sample.sampleId,
        title,
        address,
        selectedParametersCount: parsedSelectedParameters.length,
        hasFieldTestValues: !!parsedParameters,
        lifecycleStatus: sample.lifecycleStatus
      },
      ipAddress: req.ip
    });

    // Populate and return
    const populatedSample = await Sample.findById(sample._id)
      .populate('collectedBy', 'name email')
      .populate('fieldTestedBy', 'name email')
      .populate('selectedParameters', 'code name unit type testLocation');

    res.status(201).json(
      ApiResponse.success(populatedSample, message, 201)
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get samples for mobile user
 * GET /api/mobile/samples
 * Returns COLLECTED samples that need field testing
 */
const getMobileSamples = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, lifecycleStatus } = req.query;

    const query = { isDeleted: false };

    // Filter by lifecycle status if provided
    if (lifecycleStatus) {
      query.lifecycleStatus = lifecycleStatus;
    } else {
      // Default: show COLLECTED samples (need field testing)
      query.lifecycleStatus = 'COLLECTED';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [samples, total] = await Promise.all([
      Sample.find(query)
        .populate('collectedBy', 'name email')
        .populate('fieldTestedBy', 'name email')
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
      .populate('fieldTestedBy', 'name email');

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
    const parameters = await StatusEngine.getFieldParameters();

    res.json(ApiResponse.success(parameters, 'FIELD parameters retrieved successfully'));
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
