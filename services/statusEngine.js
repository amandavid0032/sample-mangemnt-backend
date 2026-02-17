/**
 * Status Engine Service
 *
 * Calculates parameter statuses based on IS10500-2012 standard.
 * Creates immutable snapshots for regulatory compliance.
 *
 * Status Values:
 * - ACCEPTABLE: Within acceptable limits
 * - PERMISSIBLE: Within permissible limits (may require treatment)
 * - NOT_ACCEPTABLE: Exceeds all limits (fails standard)
 */

const { ParameterMaster } = require('../models');

class StatusEngine {
  /**
   * Process sample analysis with immutable snapshots
   * This is the main entry point for analysing samples
   * @param {Array} parameterInputs - Array of { parameterRef, value }
   * @returns {Promise<Object>} { parameters: [...snapshots], overallStatus }
   */
  static async processSampleAnalysis(parameterInputs) {
    if (!parameterInputs || parameterInputs.length === 0) {
      return { parameters: [], overallStatus: null };
    }

    // Fetch all parameter masters in one query for efficiency
    const parameterIds = parameterInputs.map(p => p.parameterRef);
    const parameterMasters = await ParameterMaster.find({
      _id: { $in: parameterIds },
      isActive: true
    });

    // Create map for quick lookup
    const parameterMap = new Map(
      parameterMasters.map(p => [p._id.toString(), p])
    );

    // Process each parameter and create immutable snapshot
    const processedParameters = [];

    for (const input of parameterInputs) {
      const paramMaster = parameterMap.get(input.parameterRef.toString());

      if (!paramMaster) {
        console.warn(`Parameter not found or inactive: ${input.parameterRef}`);
        continue;
      }

      // Calculate status using parameter rules
      const status = paramMaster.calculateStatus(input.value);

      // Create IMMUTABLE SNAPSHOT - regulatory limits frozen at analysis time
      const snapshot = {
        parameterRef: paramMaster._id,
        // SNAPSHOT BLOCK - immutable copy of regulatory limits
        code: paramMaster.code,
        name: paramMaster.name,
        unit: paramMaster.unit,
        type: paramMaster.type,
        acceptableLimit: {
          min: paramMaster.acceptableLimit?.min ?? null,
          max: paramMaster.acceptableLimit?.max ?? null
        },
        permissibleLimit: {
          min: paramMaster.permissibleLimit?.min ?? null,
          max: paramMaster.permissibleLimit?.max ?? null
        },
        maxValue: paramMaster.maxValue,
        enumValues: [...(paramMaster.enumValues || [])],
        testMethod: paramMaster.testMethod || '',
        // Lab value
        value: input.value,
        // Computed result
        status: status
      };

      processedParameters.push(snapshot);
    }

    // Calculate overall status using worst-case rule
    const overallStatus = this.calculateOverallStatus(processedParameters);

    return {
      parameters: processedParameters,
      overallStatus
    };
  }

  /**
   * Calculate overall status from parameter statuses
   * Rule: Worst status wins
   * NOT_ACCEPTABLE > PERMISSIBLE > ACCEPTABLE
   */
  static calculateOverallStatus(parameters) {
    if (!parameters || parameters.length === 0) {
      return null;
    }

    // If any NOT_ACCEPTABLE → overall NOT_ACCEPTABLE
    const hasNotAcceptable = parameters.some(p => p.status === 'NOT_ACCEPTABLE');
    if (hasNotAcceptable) return 'NOT_ACCEPTABLE';

    // Else if any PERMISSIBLE → overall PERMISSIBLE
    const hasPermissible = parameters.some(p => p.status === 'PERMISSIBLE');
    if (hasPermissible) return 'PERMISSIBLE';

    // Else → ACCEPTABLE
    return 'ACCEPTABLE';
  }

  /**
   * Calculate status for a single parameter value
   * Used for real-time validation
   */
  static async calculateParameterStatus(parameterRefId, value) {
    const parameter = await ParameterMaster.findById(parameterRefId);

    if (!parameter) {
      throw new Error(`Parameter not found: ${parameterRefId}`);
    }

    if (!parameter.isActive) {
      return { status: 'ACCEPTABLE', unit: parameter.unit };
    }

    const status = parameter.calculateStatus(value);
    return { status, unit: parameter.unit };
  }

  /**
   * Validate parameter value based on type
   */
  static validateParameterValue(parameter, value) {
    if (value === null || value === undefined || value === '') {
      return { isValid: true, error: null };
    }

    switch (parameter.type) {
      case 'RANGE':
      case 'MAX':
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          return { isValid: false, error: `${parameter.name} must be a number` };
        }
        return { isValid: true, error: null };

      case 'ENUM':
        const normalizedValue = value.toString().toLowerCase().trim();
        const validOptions = (parameter.enumValues || []).map(v => v.toLowerCase().trim());
        if (!validOptions.includes(normalizedValue)) {
          return {
            isValid: false,
            error: `${parameter.name} must be one of: ${parameter.enumValues.join(', ')}`
          };
        }
        return { isValid: true, error: null };

      case 'TEXT':
        if (value.toString().length > 500) {
          return { isValid: false, error: `${parameter.name} cannot exceed 500 characters` };
        }
        return { isValid: true, error: null };

      default:
        return { isValid: true, error: null };
    }
  }

  /**
   * Validate all parameters before analysis
   */
  static async validateAllParameters(parameterInputs) {
    const errors = [];

    const parameterIds = parameterInputs.map(p => p.parameterRef);
    const parameters = await ParameterMaster.find({
      _id: { $in: parameterIds }
    });

    const parameterMap = new Map(
      parameters.map(p => [p._id.toString(), p])
    );

    for (const input of parameterInputs) {
      const parameter = parameterMap.get(input.parameterRef.toString());

      if (!parameter) {
        errors.push(`Parameter not found: ${input.parameterRef}`);
        continue;
      }

      const validation = this.validateParameterValue(parameter, input.value);
      if (!validation.isValid) {
        errors.push(validation.error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get status summary for a set of parameters
   */
  static getStatusSummary(parameters) {
    const summary = {
      total: parameters.length,
      acceptable: 0,
      permissible: 0,
      notAcceptable: 0
    };

    for (const param of parameters) {
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
}

module.exports = StatusEngine;
