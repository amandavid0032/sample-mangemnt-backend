const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const { protect, validate } = require('../middleware');
const { authValidators } = require('../utils/validators');

// Login only - no public registration
router.post('/login', validate(authValidators.login), authController.login);
router.get('/me', protect, authController.getMe);

module.exports = router;
