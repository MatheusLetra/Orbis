import type { FastifyRequest } from "fastify";
import { UnauthorizedError } from "@/shared/errors/typed-errors";

export function getCurrentUserId(request: FastifyRequest): string {
  if (!request.auth) {
    throw new UnauthorizedError("Usuário não autenticado");
  }
  return request.auth.userId;
}
