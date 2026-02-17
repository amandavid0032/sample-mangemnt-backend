const { Sample, AuditLog, ParameterMaster, User } = require('../models');
const StatusEngine = require('../services/statusEngine');
const ApiResponse = require('../utils/ApiResponse');
const { processUploadedFiles } = require('../services/uploadService');

// Create sample - if parameters provided, auto-publish; otherwise TESTING status
const createSample = async (req, res, next) => {
  try {
    const { address, location, collectedAt, parameters } = req.body;

    // Parse location data if string
    const locationData = typeof location === 'string' ? JSON.parse(location) : location;

    const now = new Date();
    const sampleData = {
      address,
      location: {
        type: 'Point',
        coordinates: [parseFloat(locationData.longitude), parseFloat(locationData.latitude)]
      },
      collectedBy: req.user._id,
      collectedAt: collectedAt || now,
      lifecycleStatus: 'TESTING'
    };

    // Handle uploaded images (supports both Cloudinary and local storage)
    if (req.files) {
      const imageUrls = processUploadedFiles(req.files);
      sampleData.images = imageUrls;
    }

    // If parameters are provided, process them and auto-publish
    if (parameters && Array.isArray(parameters) && parameters.length > 0) {
      const analysisResult = await StatusEngine.processSampleAnalysis(parameters);

      sampleData.parameters = analysisResult.parameters;
      sampleData.overallStatus = analysisResult.overallStatus;
      sampleData.lifecycleStatus = 'PUBLISHED';
      sampleData.submittedBy = req.user._id;
      sampleData.submittedAt = now;
      sampleData.publishedAt = now;
    }

    const sample = await Sample.create(sampleData);

    // Log action
    await AuditLog.logAction({
      action: parameters && parameters.length > 0 ? 'SAMPLE_CREATED_WITH_RESULTS' : 'SAMPLE_CREATED',
      performedBy: req.user._id,
      sampleRef: sample._id,
      details: {
        sampleId: sample.sampleId,
        address,
        status: sample.lifecycleStatus,
        overallStatus: sample.overallStatus || null,
        parametersCount: sample.parameters?.length || 0
      },
      ipAddress: req.ip
    });

    // Populate and return
    const populatedSample = await Sample.findById(sample._id)
      .populate('collectedBy', 'name email')
      .populate('submittedBy', 'name email');

    const message = parameters && parameters.length > 0
      ? 'Sample created and published with results'
      : 'Sample created successfully';

    res.status(201).json(
      ApiResponse.success(populatedSample, message, 201)
    );
  } catch (error) {
    next(error);
  }
};

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

    // All authenticated users can see all samples in simplified workflow
    // No role-based filtering needed

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
        .populate('submittedBy', 'name email')
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

const getSampleById = async (req, res, next) => {
  try {
    const sample = await Sample.findById(req.params.id)
      .populate('collectedBy', 'name email')
      .populate('submittedBy', 'name email');

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

// Submit analysis - AUTO-CALCULATES status and AUTO-PUBLISHES
const submitSample = async (req, res, next) => {
  try {
    const { parameters } = req.body;
    const sample = await Sample.findById(req.params.id);

    if (!sample) {
      return res.status(404).json(
        ApiResponse.error('Sample not found', 404)
      );
    }

    if (sample.lifecycleStatus !== 'TESTING') {
      return res.status(400).json(
        ApiResponse.error(`Sample must be in TESTING status. Current status: ${sample.lifecycleStatus}`, 400)
      );
    }

    if (sample.isDeleted) {
      return res.status(400).json(
        ApiResponse.error('Cannot submit a deleted sample', 400)
      );
    }

    // Calculate statuses using engine - creates immutable snapshots
    const analysisResult = await StatusEngine.processSampleAnalysis(parameters);

    const now = new Date();

    // Update sample with analysis results and AUTO-PUBLISH
    sample.parameters = analysisResult.parameters;
    sample.overallStatus = analysisResult.overallStatus;
    sample.lifecycleStatus = 'PUBLISHED';  // Auto-publish!
    sample.submittedBy = req.user._id;
    sample.submittedAt = now;
    sample.publishedAt = now;  // Same time as submit

    await sample.save();

    // Log action
    await AuditLog.logAction({
      action: 'SAMPLE_SUBMITTED',
      performedBy: req.user._id,
      sampleRef: sample._id,
      details: {
        parametersCount: parameters.length,
        overallStatus: analysisResult.overallStatus,
        autoPublished: true
      },
      ipAddress: req.ip
    });

    const populatedSample = await Sample.findById(sample._id)
      .populate('collectedBy', 'name email')
      .populate('submittedBy', 'name email');

    res.json(ApiResponse.success(populatedSample, 'Sample submitted and published successfully'));
  } catch (error) {
    next(error);
  }
};

// Archive sample (soft delete) - ADMIN only
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

    const previousStatus = sample.lifecycleStatus;
    sample.softDelete();
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

// Restore archived sample - ADMIN only
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

    // Restore to PUBLISHED status (if it was published before archiving)
    sample.isDeleted = false;
    sample.lifecycleStatus = sample.parameters.length > 0 ? 'PUBLISHED' : 'TESTING';

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

    // Simplified stats structure
    const stats = {
      total,
      archived: archivedCount,
      byLifecycle: {
        TESTING: 0,
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
  createSample,
  getAllSamples,
  getSampleById,
  submitSample,
  archiveSample,
  restoreSample,
  getStats
};
