import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";

import { UnauthorizedError } from "@/shared/errors/typed-errors";
import { getCurrentUserId } from "./current-user";

describe("getCurrentUserId", () => {
  it("retorna o usuário autenticado", () => {
    expect(getCurrentUserId({ auth: { userId: "user-1" } } as FastifyRequest)).toBe("user-1");
  });

  it("rejeita request sem usuário autenticado", () => {
    expect(() => getCurrentUserId({} as FastifyRequest)).toThrow(UnauthorizedError);
    expect(() => getCurrentUserId({} as FastifyRequest)).toThrow("Usuário não autenticado");
  });
});
