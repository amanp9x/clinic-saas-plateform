import { ErrorCode } from '@clinic/shared';

/** Base class for all operational (expected) errors thrown across the API. */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational = true;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(400, ErrorCode.VALIDATION_ERROR, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, ErrorCode.UNAUTHORIZED, message);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message = 'Invalid email or password') {
    super(401, ErrorCode.INVALID_CREDENTIALS, message);
  }
}

export class TokenExpiredError extends AppError {
  constructor(message = 'Token has expired') {
    super(401, ErrorCode.TOKEN_EXPIRED, message);
  }
}

export class TokenInvalidError extends AppError {
  constructor(message = 'Token is invalid') {
    super(401, ErrorCode.TOKEN_INVALID, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(403, ErrorCode.FORBIDDEN, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, ErrorCode.NOT_FOUND, `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(409, ErrorCode.CONFLICT, message);
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Too many requests') {
    super(429, ErrorCode.RATE_LIMITED, message);
  }
}
