const express = require('express');
const router = express.Router();
const { publicController } = require('../controllers');
const { validate } = require('../middleware');
const { paginationValidators, sampleValidators } = require('../utils/validators');

// Get published samples
router.get('/samples', validate(paginationValidators), publicController.getPublicSamples);

// Get single published sample
router.get('/samples/:id', validate(sampleValidators.getById), publicController.getPublicSampleById);

// Get statistics
router.get('/stats', publicController.getPublicStats);

// Get map data
router.get('/map', publicController.getMapData);

module.exports = router;
