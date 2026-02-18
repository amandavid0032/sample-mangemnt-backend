/**
 * Status Engine Service
 *
 * Calculates parameter statuses based on IS10500-2012 standard.
 * Creates immutable snapshots for regulatory compliance.
 *
 * NEW WORKFLOW: FIELD + LAB Hybrid Testing
 * - FIELD parameters: Tested on-site by TEAM_MEMBER
 * - LAB parameters: Tested in laboratory by ADMIN
 *
 * Status Values:
 * - ACCEPTABLE: Within acceptable limits
 * - PERMISSIBLE: Within permissible limits (may require treatment)
 * - NOT_ACCEPTABLE: Exceeds all limits (fails standard)
 *
 * Validation Flow (CRITICAL ORDER):
 * 1. Check null/undefined values → REJECT with validation error
 * 2. Check physical limits → REJECT if outside physical bounds
 * 3. Validate ENUM values exist in enumEvaluation → REJECT if invalid
 * 4. Only THEN calculate status (ACCEPTABLE/PERMISSIBLE/NOT_ACCEPTABLE)
 *
 * Lifecycle: COLLECTED → FIELD_TESTED → LAB_TESTED → PUBLISHED → ARCHIVED
 */

const { ParameterMaster } = require('../models');

class StatusEngine {
  /**
   * Process FIELD test parameters
   * Called when team member submits field test
   * Does NOT calculate overall status yet
   *
   * @param {Array} parameterInputs - Array of { parameterRef, value }
   * @param {Array} selectedParameters - Optional: Selected parameters from sample (if specified at creation)
   * @returns {Promise<Object>} { parameters: [...snapshots] }
   */
  static async processFieldTest(parameterInputs, selectedParameters = null) {
    if (!parameterInputs || parameterInputs.length === 0) {
      throw new Error('At least one FIELD parameter value is required');
    }

    // Get all FIELD parameters from master
    const allFieldParameterMasters = await ParameterMaster.find({
      testLocation: 'FIELD',
      isActive: true
    });

    // Determine which FIELD parameters are required
    let requiredFieldParams;
    if (selectedParameters && selectedParameters.length > 0) {
      // Filter selectedParameters to only FIELD params
      const selectedFieldIds = selectedParameters
        .filter(p => p.testLocation === 'FIELD')
        .map(p => p._id.toString());

      requiredFieldParams = allFieldParameterMasters.filter(
        p => selectedFieldIds.includes(p._id.toString())
      );
    } else {
      // No selectedParameters - require ALL FIELD parameters
      requiredFieldParams = allFieldParameterMasters;
    }

    const fieldParamIds = allFieldParameterMasters.map(p => p._id.toString());
    const requiredParamIds = requiredFieldParams.map(p => p._id.toString());
    const submittedIds = parameterInputs.map(p => p.parameterRef.toString());

    // Validate: Only FIELD parameters allowed
    for (const input of parameterInputs) {
      if (!fieldParamIds.includes(input.parameterRef.toString())) {
        const param = await ParameterMaster.findById(input.parameterRef);
        const paramName = param ? param.name : input.parameterRef;
        throw new Error(`Parameter "${paramName}" is not a FIELD parameter. Cannot submit in field test.`);
      }
    }

    // Validate: All required FIELD parameters must be submitted
    const missingFieldParams = requiredFieldParams.filter(
      p => !submittedIds.includes(p._id.toString())
    );

    if (missingFieldParams.length > 0) {
      const missingNames = missingFieldParams.map(p => p.name).join(', ');
      throw new Error(`Missing required FIELD parameters: ${missingNames}`);
    }

    // Validate: No extra parameters if selectedParameters was specified
    if (selectedParameters && selectedParameters.length > 0) {
      const extraParams = submittedIds.filter(id => !requiredParamIds.includes(id));
      if (extraParams.length > 0) {
        throw new Error('Submitted parameters not in selected parameters list for this sample');
      }
    }

    // Process only the submitted parameters (not all field params)
    const submittedMasters = allFieldParameterMasters.filter(
      p => submittedIds.includes(p._id.toString())
    );

    // Process parameters
    return await this._processParameters(parameterInputs, submittedMasters, 'FIELD');
  }

  /**
   * Process LAB test parameters
   * Called when admin submits lab test
   * Merges with existing FIELD parameters and calculates overall status
   *
   * @param {Array} parameterInputs - Array of { parameterRef, value }
   * @param {Array} existingFieldParams - Existing FIELD parameter snapshots from sample
   * @returns {Promise<Object>} { parameters: [...all snapshots], overallStatus }
   */
  static async processLabTest(parameterInputs, existingFieldParams = []) {
    if (!parameterInputs || parameterInputs.length === 0) {
      throw new Error('At least one LAB parameter value is required');
    }

    // Get all LAB parameters from master
    const labParameterMasters = await ParameterMaster.find({
      testLocation: 'LAB',
      isActive: true
    });

    const labParamIds = labParameterMasters.map(p => p._id.toString());
    const submittedIds = parameterInputs.map(p => p.parameterRef.toString());

    // Validate: Only LAB parameters allowed
    for (const input of parameterInputs) {
      if (!labParamIds.includes(input.parameterRef.toString())) {
        const param = await ParameterMaster.findById(input.parameterRef);
        const paramName = param ? param.name : input.parameterRef;
        throw new Error(`Parameter "${paramName}" is not a LAB parameter. Cannot submit in lab test.`);
      }
    }

    // Validate: All LAB parameters must be submitted
    const missingLabParams = labParameterMasters.filter(
      p => !submittedIds.includes(p._id.toString())
    );

    if (missingLabParams.length > 0) {
      const missingNames = missingLabParams.map(p => p.name).join(', ');
      throw new Error(`Missing required LAB parameters: ${missingNames}`);
    }

    // Process LAB parameters
    const labResult = await this._processParameters(parameterInputs, labParameterMasters, 'LAB');

    // Merge with existing FIELD parameters
    const allParameters = [...existingFieldParams, ...labResult.parameters];

    // Calculate overall status using ALL parameters
    const overallStatus = this.calculateOverallStatus(allParameters);

    return {
      parameters: allParameters,
      overallStatus
    };
  }

  /**
   * Internal: Process parameters and create snapshots
   */
  static async _processParameters(parameterInputs, parameterMasters, testLocation) {
    const parameterMap = new Map(
      parameterMasters.map(p => [p._id.toString(), p])
    );

    const processedParameters = [];
    const validationErrors = [];

    for (const input of parameterInputs) {
      const paramMaster = parameterMap.get(input.parameterRef.toString());

      if (!paramMaster) {
        validationErrors.push(`Parameter not found or inactive: ${input.parameterRef}`);
        continue;
      }

      // STEP 1: Validate value FIRST (physical limits, null check, type check)
      const validation = paramMaster.validatePhysicalLimits(input.value);
      if (!validation.isValid) {
        validationErrors.push(validation.error);
        continue;
      }

      // STEP 2: Calculate status (only after validation passes)
      let status;
      try {
        status = paramMaster.calculateStatus(input.value);
      } catch (calcError) {
        validationErrors.push(calcError.message);
        continue;
      }

      // STEP 3: Create IMMUTABLE SNAPSHOT
      const snapshot = {
        parameterRef: paramMaster._id,
        code: paramMaster.code,
        name: paramMaster.name,
        unit: paramMaster.unit,
        type: paramMaster.type,
        testLocation: paramMaster.testLocation,
        acceptableLimit: {
          min: paramMaster.acceptableLimit?.min ?? null,
          max: paramMaster.acceptableLimit?.max ?? null
        },
        permissibleLimit: {
          min: paramMaster.permissibleLimit?.min ?? null,
          max: paramMaster.permissibleLimit?.max ?? null
        },
        physicalLimit: {
          min: paramMaster.physicalLimit?.min ?? null,
          max: paramMaster.physicalLimit?.max ?? null
        },
        maxValue: paramMaster.maxValue,
        enumEvaluation: paramMaster.enumEvaluation
          ? Object.fromEntries(paramMaster.enumEvaluation)
          : {},
        testMethod: paramMaster.testMethod || '',
        affectsOverall: paramMaster.affectsOverall !== false,
        value: input.value,
        status: status
      };

      processedParameters.push(snapshot);
    }

    // Throw error if any validation failed
    if (validationErrors.length > 0) {
      const error = new Error('Validation failed');
      error.validationErrors = validationErrors;
      throw error;
    }

    return { parameters: processedParameters };
  }

  /**
   * Calculate overall status from parameter statuses
   * Rule: Worst status wins
   * NOT_ACCEPTABLE > PERMISSIBLE > ACCEPTABLE
   * Note: TEXT type parameters (affectsOverall=false) are excluded
   */
  static calculateOverallStatus(parameters) {
    if (!parameters || parameters.length === 0) {
      return null;
    }

    // Filter to only parameters that affect overall status
    const affectingParams = parameters.filter(p => p.affectsOverall !== false);

    if (affectingParams.length === 0) {
      return 'ACCEPTABLE';
    }

    // If any NOT_ACCEPTABLE → overall NOT_ACCEPTABLE
    const hasNotAcceptable = affectingParams.some(p => p.status === 'NOT_ACCEPTABLE');
    if (hasNotAcceptable) return 'NOT_ACCEPTABLE';

    // Else if any PERMISSIBLE → overall PERMISSIBLE
    const hasPermissible = affectingParams.some(p => p.status === 'PERMISSIBLE');
    if (hasPermissible) return 'PERMISSIBLE';

    // Else → ACCEPTABLE
    return 'ACCEPTABLE';
  }

  /**
   * Get all FIELD parameters for mobile form
   */
  static async getFieldParameters() {
    return await ParameterMaster.find({
      testLocation: 'FIELD',
      isActive: true
    }).sort({ code: 1 });
  }

  /**
   * Get all LAB parameters for admin form
   */
  static async getLabParameters() {
    return await ParameterMaster.find({
      testLocation: 'LAB',
      isActive: true
    }).sort({ code: 1 });
  }

  /**
   * Get status summary for a set of parameters
   */
  static getStatusSummary(parameters) {
    const summary = {
      total: parameters.length,
      field: 0,
      lab: 0,
      acceptable: 0,
      permissible: 0,
      notAcceptable: 0,
      affectingOverall: 0
    };

    for (const param of parameters) {
      if (param.testLocation === 'FIELD') summary.field++;
      if (param.testLocation === 'LAB') summary.lab++;
      if (param.affectsOverall !== false) summary.affectingOverall++;

      switch (param.status) {
        case 'ACCEPTABLE':
          summary.acceptable++;
          break;
        case 'PERMISSIBLE':
          summary.permissible++;
          break;
        case 'NOT_ACCEPTABLE':
          summary.notAcceptable++;
          break;
      }
    }

    return summary;
  }

  /**
   * Validate parameter inputs before processing
   */
  static async validateParameters(parameterInputs, testLocation) {
    const errors = [];
    const warnings = [];

    if (!parameterInputs || parameterInputs.length === 0) {
      errors.push(`At least one ${testLocation} parameter value is required`);
      return { isValid: false, errors, warnings };
    }

    const parameterMasters = await ParameterMaster.find({
      testLocation: testLocation,
      isActive: true
    });

    const validIds = parameterMasters.map(p => p._id.toString());

    for (const input of parameterInputs) {
      if (!validIds.includes(input.parameterRef.toString())) {
        errors.push(`Parameter ${input.parameterRef} is not a valid ${testLocation} parameter`);
      }
    }

    // Check for missing required parameters
    const submittedIds = parameterInputs.map(p => p.parameterRef.toString());
    const missingParams = parameterMasters.filter(
      p => !submittedIds.includes(p._id.toString())
    );

    if (missingParams.length > 0) {
      errors.push(`Missing required ${testLocation} parameters: ${missingParams.map(p => p.name).join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = StatusEngine;
