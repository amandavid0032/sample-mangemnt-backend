const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const { protect, validate } = require('../middleware');
const { authValidators } = require('../utils/validators');

// Login only - no public registration
router.post('/login', validate(authValidators.login), authController.login);

// Protected routes
router.get('/me', protect, authController.getMe);
router.put('/profile', protect, validate(authValidators.updateProfile), authController.updateProfile);
router.post('/logout', protect, authController.logout);

module.exports = router;
