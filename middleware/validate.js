const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/ApiResponse');

const validate = (validations) => {
  return async (req, res, next) => {
    for (let validation of validations) {
      const result = await validation.run(req);
      if (result.errors.length) break;
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg
    }));

    return res.status(400).json(
      ApiResponse.error('Validation failed', 400, extractedErrors)
    );
  };
};

module.exports = validate;
