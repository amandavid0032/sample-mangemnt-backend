const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { jwtSecret } = require('../config');
const ApiResponse = require('../utils/ApiResponse');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json(
        ApiResponse.error('Not authorized, no token provided', 401)
      );
    }

    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json(
        ApiResponse.error('User not found', 401)
      );
    }

    if (!user.isActive) {
      return res.status(401).json(
        ApiResponse.error('Account is deactivated', 401)
      );
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json(
        ApiResponse.error('Invalid token', 401)
      );
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json(
        ApiResponse.error('Token expired', 401)
      );
    }
    return res.status(500).json(
      ApiResponse.error('Authentication error', 500)
    );
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json(
        ApiResponse.error(`Role ${req.user.role} is not authorized to access this route`, 403)
      );
    }
    next();
  };
};

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

module.exports = {
  protect,
  authorize,
  generateToken
};
