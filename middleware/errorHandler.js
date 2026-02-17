const ApiResponse = require('../utils/ApiResponse');

const errorHandler = (err, req, res, _next) => {
  let error = { ...err };
  error.message = err.message;

  console.error('Error:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    return res.status(404).json(ApiResponse.error(message, 404));
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate value for ${field}`;
    return res.status(400).json(ApiResponse.error(message, 400));
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json(ApiResponse.error(messages.join(', '), 400));
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(ApiResponse.error('Invalid token', 401));
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(ApiResponse.error('Token expired', 401));
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(ApiResponse.error('File too large', 400));
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json(ApiResponse.error('Unexpected file field', 400));
  }

  // Default error
  res.status(error.statusCode || 500).json(
    ApiResponse.error(error.message || 'Server Error', error.statusCode || 500)
  );
};

module.exports = errorHandler;
