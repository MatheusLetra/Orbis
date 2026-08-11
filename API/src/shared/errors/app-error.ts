export interface AppErrorOptions {
  details?: Record<string, unknown>;
  cause?: unknown;
}

export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  readonly details?: Record<string, unknown>;
  override readonly cause?: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = new.target.name;
    this.details = options.details;
    this.cause = options.cause;
    Error.captureStackTrace?.(this, new.target);
  }
}
