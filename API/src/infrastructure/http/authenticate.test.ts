import type { FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import type { TokenService } from "@/modules/auth/application/ports/token-service";
import type { UnauthorizedError } from "@/shared/errors/typed-errors";
import { createAuthenticateHook } from "./authenticate";

function request(authorization?: string): FastifyRequest {
  return { headers: { authorization } } as FastifyRequest;
}

function tokenService(
  verifyAccessToken: TokenService["verifyAccessToken"] = vi
    .fn()
    .mockResolvedValue({ sub: "user-1" }),
): TokenService {
  return {
    signAccessToken: vi.fn(),
    verifyAccessToken,
    signRefreshToken: vi.fn(),
    verifyRefreshToken: vi.fn(),
  };
}

describe("createAuthenticateHook", () => {
  it.each([undefined, "", "Basic token", "Bearer", "Bearer   "])(
    "rejeita bearer ausente ou vazio: %s",
    async (authorization) => {
      const service = tokenService();

      await expect(createAuthenticateHook(service)(request(authorization))).rejects.toEqual(
        expect.objectContaining<Partial<UnauthorizedError>>({
          message: "Token de acesso não fornecido",
        }),
      );
      expect(service.verifyAccessToken).not.toHaveBeenCalled();
    },
  );

  it.each(["inválido", "expirado"])("rejeita token %s", async (reason) => {
    const service = tokenService(vi.fn().mockRejectedValue(new Error(reason)));

    await expect(
      createAuthenticateHook(service)(request(`Bearer token-${reason}`)),
    ).rejects.toEqual(
      expect.objectContaining<Partial<UnauthorizedError>>({
        message: "Token de acesso inválido ou expirado",
      }),
    );
  });

  it("registra o usuário autenticado a partir do subject", async () => {
    const service = tokenService();
    const authenticatedRequest = request("Bearer token-valido");

    await createAuthenticateHook(service)(authenticatedRequest);

    expect(service.verifyAccessToken).toHaveBeenCalledWith("token-valido");
    expect(authenticatedRequest.auth).toEqual({ userId: "user-1" });
  });
});
