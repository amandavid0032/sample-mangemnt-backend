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

module.exports = {
  login,
  getMe
};
