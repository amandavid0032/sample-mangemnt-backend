const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const sampleRoutes = require('./sampleRoutes');
const userRoutes = require('./userRoutes');
const publicRoutes = require('./publicRoutes');
const parameterRoutes = require('./parameterRoutes');
const mobileRoutes = require('./mobileRoutes');

router.use('/auth', authRoutes);
router.use('/samples', sampleRoutes);
router.use('/users', userRoutes);
router.use('/public', publicRoutes);
router.use('/parameters', parameterRoutes);
router.use('/mobile', mobileRoutes);

module.exports = router;
