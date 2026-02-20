const { Sample } = require('../models');
const ApiResponse = require('../utils/ApiResponse');
const { generateSampleReport } = require('../services/reportService');

const getPublicSamples = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, overallStatus, fromDate, toDate, search } = req.query;

    const query = { 'testInfo.published': true, isDeleted: false };

    if (overallStatus) {
      query.overallStatus = overallStatus;
    }

    if (search) {
      query.address = { $regex: search, $options: 'i' };
    }

    if (fromDate || toDate) {
      query.collectedAt = {};
      if (fromDate) query.collectedAt.$gte = new Date(fromDate);
      if (toDate) query.collectedAt.$lte = new Date(toDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [samples, total] = await Promise.all([
      Sample.find(query)
        .select('sampleId address location parameters overallStatus images collectedAt testInfo standardVersion')
        .sort({ collectedAt: -1 })
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
      }, 'Public samples retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

const getPublicSampleById = async (req, res, next) => {
  try {
    const sample = await Sample.findOne({
      _id: req.params.id,
      'testInfo.published': true,
      isDeleted: false
    })
      .select('sampleId address location parameters overallStatus images collectedAt testInfo standardVersion');

    if (!sample) {
      return res.status(404).json(
        ApiResponse.error('Sample not found or not published', 404)
      );
    }

    res.json(ApiResponse.success(sample, 'Sample retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

const getPublicStats = async (req, res, next) => {
  try {
    const [totalPublished, statusStats] = await Promise.all([
      Sample.countDocuments({ 'testInfo.published': true, isDeleted: false }),
      Sample.aggregate([
        { $match: { 'testInfo.published': true, isDeleted: false } },
        { $group: { _id: '$overallStatus', count: { $sum: 1 } } }
      ])
    ]);

    const stats = {
      totalPublished,
      byStatus: {
        ACCEPTABLE: 0,
        PERMISSIBLE: 0,
        NOT_ACCEPTABLE: 0
      }
    };

    statusStats.forEach(stat => {
      if (stat._id) {
        stats.byStatus[stat._id] = stat.count;
      }
    });

    res.json(ApiResponse.success(stats, 'Public statistics retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

const getMapData = async (req, res, next) => {
  try {
    const samples = await Sample.find({ 'testInfo.published': true, isDeleted: false })
      .select('sampleId address location overallStatus')
      .lean();

    // Transform for map display
    const mapData = samples.map(sample => ({
      sampleId: sample.sampleId,
      address: sample.address,
      coordinates: sample.location?.coordinates ? {
        longitude: sample.location.coordinates[0],
        latitude: sample.location.coordinates[1]
      } : null,
      overallStatus: sample.overallStatus
    }));

    res.json(ApiResponse.success(mapData, 'Map data retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Download public sample as PDF report
 * GET /api/public/samples/:id/pdf
 */
const downloadPublicPDF = async (req, res, next) => {
  try {
    const sample = await Sample.findOne({
      _id: req.params.id,
      'testInfo.published': true,
      isDeleted: false
    });

    if (!sample) {
      return res.status(404).json(
        ApiResponse.error('Sample not found or not published', 404)
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
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicSamples,
  getPublicSampleById,
  getPublicStats,
  getMapData,
  downloadPublicPDF
};
