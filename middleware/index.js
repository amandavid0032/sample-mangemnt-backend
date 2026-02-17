const { protect, authorize, generateToken } = require('./auth');
const errorHandler = require('./errorHandler');
const validate = require('./validate');

module.exports = {
  protect,
  authorize,
  generateToken,
  errorHandler,
  validate
};
