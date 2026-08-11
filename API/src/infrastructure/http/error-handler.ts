import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import { AppError } from "@/shared/errors/app-error";
import { toErrorResponse } from "@/shared/errors/error-response";

export interface ErrorHandlerOptions {
  exposeInternalDetails: boolean;
}

function isHttpErrorWithStatus(error: unknown): error is FastifyError & { statusCode: number } {
  return (
    error instanceof Error && typeof (error as { statusCode?: unknown }).statusCode === "number"
  );
}

export function createErrorHandler(options: ErrorHandlerOptions) {
  return function errorHandler(
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply,
  ): void {
    if (error instanceof AppError) {
      const response = toErrorResponse(error);
      void reply.status(response.statusCode).send(response.body);
      return;
    }

    if (error instanceof ZodError) {
      void reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Entrada inválida",
          details: { issues: error.issues },
        },
      });
      return;
    }

    if (isHttpErrorWithStatus(error) && error.statusCode < 500) {
      const hasValidation = "validation" in error && Array.isArray(error.validation);
      void reply.status(error.statusCode).send({
        error: {
          code: hasValidation ? "VALIDATION_ERROR" : "HTTP_ERROR",
          message: error.message,
          ...(hasValidation ? { details: { issues: error.validation } } : {}),
        },
      });
      return;
    }

    request.log.error({ err: error }, "erro interno não tratado");

    const message =
      options.exposeInternalDetails && error instanceof Error
        ? error.message
        : "Erro interno do servidor";

    void reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message,
      },
    });
  };
}
