import type { AppError } from "./app-error.js";

export interface ErrorResponse {
  statusCode: number;
  body: {
    error: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };
  };
}

export function toErrorResponse(error: AppError): ErrorResponse {
  return {
    statusCode: error.statusCode,
    body: {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
  };
}
