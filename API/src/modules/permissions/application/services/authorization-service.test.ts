import { describe, expect, it } from "vitest";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import type { Permission } from "@/modules/permissions/domain/permission";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ForbiddenError } from "@/shared/errors/typed-errors";

function actor(permissions: Permission[]): AuthenticatedUser {
  return { userId: "u1", companyId: "c1", permissions };
}

describe("AuthorizationService", () => {
  const service = new AuthorizationService();

  it("aceita quando o usuário possui a permissão", () => {
    expect(() => service.assertPermission(actor(["company.read"]), "company.read")).not.toThrow();
  });

  it("lança ForbiddenError quando a permissão é exigida", () => {
    expect(() => service.assertPermission(actor([]), "company.update")).toThrow(ForbiddenError);
  });

  it("lança ForbiddenError com o nome da permissão no erro", () => {
    try {
      service.assertPermission(actor(["company.read"]), "users.manage");
      throw new Error("não deveria chegar aqui");
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).message).toContain("users.manage");
    }
  });

  it("aceita quando o contexto de empresa confere", () => {
    expect(() => service.assertCompanyContext(actor([]), "c1")).not.toThrow();
  });

  it("lança ForbiddenError quando o contexto de empresa diverge", () => {
    expect(() => service.assertCompanyContext(actor([]), "c2")).toThrow(ForbiddenError);
  });
});
