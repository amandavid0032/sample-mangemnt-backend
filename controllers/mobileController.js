const { Sample, AuditLog, ParameterMaster } = require('../models');
const StatusEngine = require('../services/statusEngine');
const ApiResponse = require('../utils/ApiResponse');

// Get samples for mobile user
// - CREATED samples: visible to ALL team members (anyone can accept)
// - ACCEPTED/ANALYSED samples: visible ONLY to the user who accepted them
const getMobileSamples = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, lifecycleStatus } = req.query;

    let query = { isDeleted: false };

    if (lifecycleStatus === 'CREATED') {
      // All CREATED samples - available to all team members
      query.lifecycleStatus = 'CREATED';
    } else if (lifecycleStatus) {
      // Specific status (ACCEPTED, ANALYSED) - only show samples accepted by this user
      query.lifecycleStatus = lifecycleStatus;
      query.acceptedBy = req.user._id;
    } else {
      // No filter - show CREATED (all) + samples accepted by this user
      query.$or = [
        { lifecycleStatus: 'CREATED' },
        { acceptedBy: req.user._id }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [samples, total] = await Promise.all([
      Sample.find(query)
        .populate('acceptedBy', 'name')
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

// Get single sample by ID for mobile
// - CREATED: any team member can view
// - ACCEPTED/ANALYSED: only the user who accepted can view
const getMobileSampleById = async (req, res, next) => {
  try {
    const sample = await Sample.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!sample) {
      return res.status(404).json(
        ApiResponse.error('Sample not found', 404)
      );
    }

    // If sample is not CREATED, check if current user accepted it
    if (sample.lifecycleStatus !== 'CREATED') {
      if (!sample.acceptedBy || sample.acceptedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json(
          ApiResponse.error('You are not authorized to view this sample', 403)
        );
      }
    }

    res.json(ApiResponse.success(sample, 'Sample retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Accept sample (mobile)
// - Any team member can accept a CREATED sample
// - Once accepted, sample is locked to that user
const acceptMobileSample = async (req, res, next) => {
  try {
    const sample = await Sample.findById(req.params.id);

    if (!sample) {
      return res.status(404).json(
        ApiResponse.error('Sample not found', 404)
      );
    }

    if (sample.isDeleted) {
      return res.status(400).json(
        ApiResponse.error('Cannot accept deleted sample', 400)
      );
    }

    if (sample.lifecycleStatus !== 'CREATED') {
      return res.status(400).json(
        ApiResponse.error(`Cannot accept sample. Current status: ${sample.lifecycleStatus}. Sample may already be accepted by another team member.`, 400)
      );
    }

    // Accept the sample - lock it to this user
    sample.lifecycleStatus = 'ACCEPTED';
    sample.acceptedBy = req.user._id;
    sample.acceptedAt = new Date();
    await sample.save();

    // Log action
    await AuditLog.logAction({
      action: 'SAMPLE_ACCEPTED',
      performedBy: req.user._id,
      sampleRef: sample._id,
      details: { previousStatus: 'CREATED', newStatus: 'ACCEPTED' },
      ipAddress: req.ip
    });

    res.json(ApiResponse.success(sample, 'Sample accepted successfully. You can now fill in the parameters.'));
  } catch (error) {
    next(error);
  }
};

// Submit sample with parameters (mobile) - transitions to ANALYSED
// - Only the user who accepted the sample can submit
const submitMobileSample = async (req, res, next) => {
  try {
    const { parameters } = req.body;
    const sample = await Sample.findById(req.params.id);

    if (!sample) {
      return res.status(404).json(
        ApiResponse.error('Sample not found', 404)
      );
    }

    // Check if this user accepted the sample
    if (!sample.acceptedBy || sample.acceptedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json(
        ApiResponse.error('You are not authorized to submit this sample. Only the user who accepted can submit.', 403)
      );
    }

    if (sample.lifecycleStatus !== 'ACCEPTED') {
      return res.status(400).json(
        ApiResponse.error('Sample must be ACCEPTED before submitting parameters', 400)
      );
    }

    // Calculate statuses using engine - creates immutable snapshots
    const analysisResult = await StatusEngine.processSampleAnalysis(parameters);

    sample.parameters = analysisResult.parameters;
    sample.overallStatus = analysisResult.overallStatus;
    sample.lifecycleStatus = 'ANALYSED';
    sample.analysedBy = req.user._id;
    sample.analysedAt = new Date();

    await sample.save();

    // Log action
    await AuditLog.logAction({
      action: 'SAMPLE_ANALYSED',
      performedBy: req.user._id,
      sampleRef: sample._id,
      details: {
        parametersCount: parameters.length,
        overallStatus: analysisResult.overallStatus
      },
      ipAddress: req.ip
    });

    res.json(ApiResponse.success(sample, 'Sample analysed successfully. Waiting for admin review.'));
  } catch (error) {
    next(error);
  }
};

// Get all parameters for mobile form
const getParameters = async (req, res, next) => {
  try {
    const parameters = await ParameterMaster.find({ isActive: true })
      .select('code name unit type acceptableLimit permissibleLimit enumValues testMethod')
      .sort({ code: 1 });

    res.json(ApiResponse.success(parameters, 'Parameters retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMobileSamples,
  getMobileSampleById,
  acceptMobileSample,
  submitMobileSample,
  getParameters
};
