const { User, AuditLog } = require('../models');
const ApiResponse = require('../utils/ApiResponse');

const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;

    const query = {};

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    res.json(
      ApiResponse.paginated(users, {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }, 'Users retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json(
        ApiResponse.error('User not found', 404)
      );
    }

    res.json(ApiResponse.success(user, 'User retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json(
        ApiResponse.error('User not found', 404)
      );
    }

    // Prevent admin from deactivating themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json(
        ApiResponse.error('Cannot modify your own status', 400)
      );
    }

    const previousStatus = user.isActive;
    user.isActive = isActive;
    await user.save();

    // Log action
    await AuditLog.logAction({
      action: 'USER_STATUS_CHANGED',
      performedBy: req.user._id,
      userRef: user._id,
      details: { previousStatus, newStatus: isActive },
      ipAddress: req.ip
    });

    res.json(ApiResponse.success(user, 'User status updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Admin creates users - no public registration
// Only TEAM_MEMBER role can be created via API
const createUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json(
        ApiResponse.error('Email already registered', 400)
      );
    }

    // Force role to TEAM_MEMBER - ADMIN and PUBLIC_VIEWER cannot be created via API
    const user = await User.create({
      name,
      email,
      password,
      role: 'TEAM_MEMBER'
    });

    // Log action
    await AuditLog.logAction({
      action: 'USER_CREATED',
      performedBy: req.user._id,
      userRef: user._id,
      details: { role: user.role, createdByAdmin: true },
      ipAddress: req.ip
    });

    res.status(201).json(
      ApiResponse.success({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }, 'User created successfully', 201)
    );
  } catch (error) {
    next(error);
  }
};

// Delete user - only TEAM_MEMBER can be deleted, ADMIN is protected
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json(
        ApiResponse.error('User not found', 404)
      );
    }

    // Prevent deleting ADMIN users
    if (user.role === 'ADMIN') {
      return res.status(403).json(
        ApiResponse.error('Cannot delete ADMIN users', 403)
      );
    }

    // Prevent deleting PUBLIC_VIEWER users
    if (user.role === 'PUBLIC_VIEWER') {
      return res.status(403).json(
        ApiResponse.error('Cannot delete PUBLIC_VIEWER users', 403)
      );
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json(
        ApiResponse.error('Cannot delete your own account', 400)
      );
    }

    await User.findByIdAndDelete(req.params.id);

    // Log action
    await AuditLog.logAction({
      action: 'USER_DELETED',
      performedBy: req.user._id,
      userRef: user._id,
      details: { deletedUser: { name: user.name, email: user.email, role: user.role } },
      ipAddress: req.ip
    });

    res.json(ApiResponse.success(null, 'User deleted successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserStatus,
  createUser,
  deleteUser
};
