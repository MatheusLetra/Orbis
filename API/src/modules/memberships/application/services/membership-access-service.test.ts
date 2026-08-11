import { describe, expect, it } from "vitest";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { ForbiddenError } from "@/shared/errors/typed-errors";
import { InMemoryMembershipRepository } from "@/test/fakes/identity-fakes";
import { MembershipAccessService } from "./membership-access-service";

describe("MembershipAccessService", () => {
  it("permite acesso quando existe membership ativa", async () => {
    const repository = new InMemoryMembershipRepository();
    await repository.create(
      Membership.create({ companyId: "company-1", userId: "user-1", position: "GESTOR" }),
    );

    const service = new MembershipAccessService(repository);

    await expect(service.assertAccess("user-1", "company-1")).resolves.toBeUndefined();
  });

  it("lança ForbiddenError quando não existe membership", async () => {
    const service = new MembershipAccessService(new InMemoryMembershipRepository());

    await expect(service.assertAccess("user-1", "company-1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("lança ForbiddenError quando a membership está inativa", async () => {
    const repository = new InMemoryMembershipRepository();
    const membership = Membership.create({
      companyId: "company-1",
      userId: "user-1",
      position: "GESTOR",
    });
    membership.deactivate();
    await repository.create(membership);

    const service = new MembershipAccessService(repository);

    await expect(service.assertAccess("user-1", "company-1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
