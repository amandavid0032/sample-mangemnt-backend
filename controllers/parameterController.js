const { ParameterMaster, AuditLog } = require('../models');
const ApiResponse = require('../utils/ApiResponse');

const getAllParameters = async (req, res, next) => {
  try {
    const {
      includeInactive,
      page = 1,
      limit = 10,
      all = 'false'
    } = req.query;

    const query = {};
    if (!includeInactive || includeInactive !== 'true') {
      query.isActive = true;
    }

    // If all=true, return all parameters without pagination (for dropdowns, etc.)
    if (all === 'true') {
      const parameters = await ParameterMaster.find(query).sort({ createdAt: -1 });
      return res.json(ApiResponse.success(parameters, 'Parameters retrieved successfully'));
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [parameters, total] = await Promise.all([
      ParameterMaster.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ParameterMaster.countDocuments(query)
    ]);

    res.json(
      ApiResponse.paginated(parameters, {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }, 'Parameters retrieved successfully')
    );
  } catch (error) {
    next(error);
  }
};

const getParameterById = async (req, res, next) => {
  try {
    const parameter = await ParameterMaster.findById(req.params.id);

    if (!parameter) {
      return res.status(404).json(
        ApiResponse.error('Parameter not found', 404)
      );
    }

    res.json(ApiResponse.success(parameter, 'Parameter retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

const createParameter = async (req, res, next) => {
  try {
    const {
      code,
      name,
      unit,
      type,
      acceptableLimit,
      permissibleLimit,
      physicalLimit,
      enumEvaluation,
      affectsOverall,
      testMethod
    } = req.body;

    // Check if code already exists
    const existingCode = await ParameterMaster.findOne({ code: code.toUpperCase() });
    if (existingCode) {
      return res.status(400).json(
        ApiResponse.error('Parameter with this code already exists', 400)
      );
    }

    // Check if name already exists
    const existingName = await ParameterMaster.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingName) {
      return res.status(400).json(
        ApiResponse.error('Parameter with this name already exists', 400)
      );
    }

    const parameterData = {
      code: code.toUpperCase(),
      name,
      unit,
      type
    };

    // Set limits based on type
    if (type === 'RANGE' || type === 'MAX') {
      if (acceptableLimit) {
        parameterData.acceptableLimit = {
          min: acceptableLimit.min ?? null,
          max: acceptableLimit.max ?? null
        };
      }
      if (permissibleLimit) {
        parameterData.permissibleLimit = {
          min: permissibleLimit.min ?? null,
          max: permissibleLimit.max ?? null
        };
      }
      if (physicalLimit) {
        parameterData.physicalLimit = {
          min: physicalLimit.min ?? null,
          max: physicalLimit.max ?? null
        };
      }
    }

    // Set enumEvaluation for ENUM type
    if (type === 'ENUM' && enumEvaluation) {
      parameterData.enumEvaluation = enumEvaluation;
    }

    // Set affectsOverall (default true, TEXT types should be false)
    if (affectsOverall !== undefined) {
      parameterData.affectsOverall = affectsOverall;
    } else if (type === 'TEXT') {
      parameterData.affectsOverall = false;
    }

    // Set test method
    if (testMethod) {
      parameterData.testMethod = testMethod;
    }

    const parameter = await ParameterMaster.create(parameterData);

    res.status(201).json(
      ApiResponse.success(parameter, 'Parameter created successfully', 201)
    );
  } catch (error) {
    next(error);
  }
};

const updateParameter = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const parameter = await ParameterMaster.findById(id);

    if (!parameter) {
      return res.status(404).json(
        ApiResponse.error('Parameter not found', 404)
      );
    }

    // Update allowed fields
    if (updates.code !== undefined) {
      parameter.code = updates.code.toUpperCase();
    }
    if (updates.name !== undefined) {
      parameter.name = updates.name;
    }
    if (updates.unit !== undefined) {
      parameter.unit = updates.unit;
    }
    if (updates.type !== undefined) {
      parameter.type = updates.type;
    }
    if (updates.acceptableLimit !== undefined) {
      parameter.acceptableLimit = {
        min: updates.acceptableLimit?.min ?? null,
        max: updates.acceptableLimit?.max ?? null
      };
    }
    if (updates.permissibleLimit !== undefined) {
      parameter.permissibleLimit = {
        min: updates.permissibleLimit?.min ?? null,
        max: updates.permissibleLimit?.max ?? null
      };
    }
    if (updates.physicalLimit !== undefined) {
      parameter.physicalLimit = {
        min: updates.physicalLimit?.min ?? null,
        max: updates.physicalLimit?.max ?? null
      };
    }
    if (updates.enumEvaluation !== undefined) {
      parameter.enumEvaluation = updates.enumEvaluation;
    }
    if (updates.affectsOverall !== undefined) {
      parameter.affectsOverall = updates.affectsOverall;
    }
    if (updates.testMethod !== undefined) {
      parameter.testMethod = typeof updates.testMethod === 'string' ? updates.testMethod : '';
    }
    if (updates.isActive !== undefined) {
      parameter.isActive = updates.isActive;
    }

    await parameter.save();

    res.json(ApiResponse.success(parameter, 'Parameter updated successfully'));
  } catch (error) {
    next(error);
  }
};

const toggleParameterStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const parameter = await ParameterMaster.findById(id);

    if (!parameter) {
      return res.status(404).json(
        ApiResponse.error('Parameter not found', 404)
      );
    }

    parameter.isActive = !parameter.isActive;
    await parameter.save();

    res.json(ApiResponse.success(parameter, `Parameter ${parameter.isActive ? 'activated' : 'deactivated'} successfully`));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllParameters,
  getParameterById,
  createParameter,
  updateParameter,
  toggleParameterStatus
};
