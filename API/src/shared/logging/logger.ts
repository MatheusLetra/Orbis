import pino, { type DestinationStream, type Logger, type LoggerOptions } from "pino";

export interface CreateLoggerOptions {
  level?: string;
  environment?: string;
  destination?: DestinationStream;
  redact?: LoggerOptions["redact"];
}

const DEFAULT_REDACT_PATHS = [
  "password",
  "token",
  "secret",
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.token",
  "*.secret",
];

export function createLoggerConfig(options: CreateLoggerOptions = {}): LoggerOptions {
  return {
    level: options.level ?? "info",
    base: {
      service: "orbis-api",
      ...(options.environment ? { env: options.environment } : {}),
    },
    redact: options.redact ?? {
      paths: DEFAULT_REDACT_PATHS,
      censor: "[REDACTED]",
    },
  };
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  return pino(createLoggerConfig(options), options.destination);
}
