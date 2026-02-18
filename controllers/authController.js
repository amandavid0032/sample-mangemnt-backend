const { User, AuditLog } = require('../models');
const { generateToken } = require('../middleware/auth');
const ApiResponse = require('../utils/ApiResponse');

// Login only - no public registration
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json(
        ApiResponse.error('Invalid credentials', 401)
      );
    }

    if (!user.isActive) {
      return res.status(401).json(
        ApiResponse.error('Account is deactivated. Contact administrator.', 401)
      );
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json(
        ApiResponse.error('Invalid credentials', 401)
      );
    }

    const token = generateToken(user._id);

    // Log action
    await AuditLog.logAction({
      action: 'USER_LOGIN',
      performedBy: user._id,
      details: { email: user.email },
      ipAddress: req.ip
    });

    res.json(
      ApiResponse.success({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      }, 'Login successful')
    );
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    res.json(
      ApiResponse.success({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      }, 'User profile retrieved')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * PUT /api/auth/profile
 * Only allows updating: name, email, password
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json(
        ApiResponse.error('User not found', 404)
      );
    }

    // Update only provided fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (password) user.password = password;

    await user.save();

    // Log action
    await AuditLog.logAction({
      action: 'PROFILE_UPDATED',
      performedBy: user._id,
      details: {
        updatedFields: Object.keys(req.body).filter(k => k !== 'password')
      },
      ipAddress: req.ip
    });

    res.json(
      ApiResponse.success({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }, 'Profile updated successfully')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 * For JWT, logout is handled client-side by removing token
 * This endpoint logs the action for audit purposes
 */
const logout = async (req, res, next) => {
  try {
    // Log action
    await AuditLog.logAction({
      action: 'USER_LOGOUT',
      performedBy: req.user._id,
      details: { email: req.user.email },
      ipAddress: req.ip
    });

    res.json(
      ApiResponse.success(null, 'Logged out successfully')
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  getMe,
  updateProfile,
  logout
};
