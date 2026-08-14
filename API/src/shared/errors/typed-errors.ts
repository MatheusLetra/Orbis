import { AppError } from "./app-error";

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";
  readonly statusCode = 404;
}

export class UnauthorizedError extends AppError {
  readonly code = "UNAUTHORIZED";
  readonly statusCode = 401;
}

export class ForbiddenError extends AppError {
  readonly code = "FORBIDDEN";
  readonly statusCode = 403;
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR";
  readonly statusCode = 400;
}

export class ConflictError extends AppError {
  readonly code = "CONFLICT";
  readonly statusCode = 409;
}

export class TooManyRequestsError extends AppError {
  readonly code = "TOO_MANY_REQUESTS";
  readonly statusCode = 429;
}

export class BusinessRuleError extends AppError {
  readonly code = "BUSINESS_RULE";
  readonly statusCode = 422;
}

export class CapacityConfigurationMissingError extends AppError {
  readonly code = "CAPACITY_CONFIGURATION_MISSING";
  readonly statusCode = 422;
}

export class CapacityZeroError extends AppError {
  readonly code = "CAPACITY_ZERO";
  readonly statusCode = 422;
}
