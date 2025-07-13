/**
 * Error handling utilities
 * Provides custom error classes for better error management
 */

export class CdkoError extends Error {
  constructor(message, code = 'CDKO_ERROR') {
    super(message);
    this.name = 'CdkoError';
    this.code = code;
  }
}

export class ValidationError extends CdkoError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends CdkoError {
  constructor(message, profile) {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
    this.profile = profile;
  }
}

export class ConfigurationError extends CdkoError {
  constructor(message) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigurationError';
  }
}

export class DeploymentError extends CdkoError {
  constructor(message, region, stackName) {
    super(message, 'DEPLOYMENT_ERROR');
    this.name = 'DeploymentError';
    this.region = region;
    this.stackName = stackName;
  }
}

export function handleError(error) {
  if (error instanceof CdkoError) {
    return {
      message: error.message,
      code: error.code,
      ...error
    };
  }
  
  return {
    message: error.message || 'Unknown error',
    code: 'UNKNOWN_ERROR'
  };
}