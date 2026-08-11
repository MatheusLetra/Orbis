import type { FastifyRequest } from "fastify";
import type { TokenService } from "@/modules/auth/application/ports/token-service";
import { UnauthorizedError } from "@/shared/errors/typed-errors";

export interface AuthenticatedUser {
  userId: string;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthenticatedUser;
  }
}

export function createAuthenticateHook(tokenService: TokenService) {
  return async function authenticate(request: FastifyRequest): Promise<void> {
    const header = request.headers.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) {
      throw new UnauthorizedError("Token de acesso não fornecido");
    }

    const token = header.slice("Bearer ".length).trim();
    if (token.length === 0) {
      throw new UnauthorizedError("Token de acesso não fornecido");
    }

    try {
      const payload = await tokenService.verifyAccessToken(token);
      request.auth = { userId: payload.sub };
    } catch {
      throw new UnauthorizedError("Token de acesso inválido ou expirado");
    }
  };
}
