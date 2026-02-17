const express = require('express');
const router = express.Router();
const { userController } = require('../controllers');
const { protect, authorize, validate } = require('../middleware');
const { userValidators, authValidators, paginationValidators } = require('../utils/validators');

// All routes require admin authentication
router.use(protect);
router.use(authorize('ADMIN'));

router.get('/', validate(paginationValidators), userController.getAllUsers);
router.get('/:id', validate(userValidators.getById), userController.getUserById);
router.post('/', validate(authValidators.createUser), userController.createUser);
router.patch('/:id/status', validate(userValidators.updateStatus), userController.updateUserStatus);
router.delete('/:id', validate(userValidators.getById), userController.deleteUser);

module.exports = router;
