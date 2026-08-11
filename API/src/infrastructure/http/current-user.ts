import type { FastifyRequest } from "fastify";
import { UnauthorizedError } from "@/shared/errors/typed-errors";

const CURRENT_USER_HEADER = "x-user-id";

export function getCurrentUserId(request: FastifyRequest): string {
  const userId = request.headers[CURRENT_USER_HEADER];
  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new UnauthorizedError("Usuário não autenticado");
  }
  return userId.trim();
}
