import { describe, expect, it } from "vitest";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { MembershipPermissionResolver } from "@/modules/memberships/infrastructure/resolvers/membership-permission-resolver";
import { DashboardPolicy } from "@/modules/permissions/domain/dashboard-policy";
import { permissionsForRole } from "@/modules/permissions/domain/role";
import { ForbiddenError } from "@/shared/errors/typed-errors";
import { InMemoryMembershipRepository } from "@/test/fakes/identity-fakes";

function build() {
  const membershipRepository = new InMemoryMembershipRepository();
  const resolver = new MembershipPermissionResolver(membershipRepository);
  return { membershipRepository, resolver };
}

async function seedMembership(
  repository: InMemoryMembershipRepository,
  userId: string,
  companyId: string,
  position: string,
) {
  return repository.create(Membership.create({ companyId, userId, position }));
}

describe("MembershipPermissionResolver", () => {
  it("resolve as permissões do preset do cargo quando a membership não tem permissões explícitas", async () => {
    const { membershipRepository, resolver } = build();
    const membership = await seedMembership(membershipRepository, "u1", "c1", "GESTOR");

    const actor = await resolver.resolve("u1", "c1");

    expect(actor).toEqual({
      userId: "u1",
      companyId: "c1",
      permissions: expect.arrayContaining(permissionsForRole("GESTOR")),
    });
    expect(actor.permissions).toContain("company.update");
    expect(membership.permissions).toEqual([]);
  });

  it("prioriza as permissões explícitas da membership", async () => {
    const { membershipRepository, resolver } = build();
    const membership = await seedMembership(membershipRepository, "u1", "c1", "GESTOR");
    membership.changePermissions(["company.read"]);
    await membershipRepository.update(membership);

    const actor = await resolver.resolve("u1", "c1");

    expect(actor.permissions).toContain("company.read");
    expect(actor.permissions).not.toContain("company.update");
  });

  it("aplica a política de dashboard sobre a base de permissões", async () => {
    const { membershipRepository } = build();
    const membership = await seedMembership(membershipRepository, "u1", "c1", "DESENVOLVEDOR");
    membership.changePermissions(["tasks.read"]);
    await membershipRepository.update(membership);

    const resolver = new MembershipPermissionResolver(
      membershipRepository,
      new DashboardPolicy({
        companyDefault: ["kanban.manage"],
      }),
    );
    const actor = await resolver.resolve("u1", "c1");

    expect(actor.permissions).toContain("tasks.read");
    expect(actor.permissions).toContain("kanban.manage");
  });

  it("lança ForbiddenError sem membership", async () => {
    const { resolver } = build();

    await expect(resolver.resolve("u1", "c1")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lança ForbiddenError com membership inativa", async () => {
    const { membershipRepository, resolver } = build();
    const membership = await seedMembership(membershipRepository, "u1", "c1", "GESTOR");
    membership.deactivate();
    await membershipRepository.update(membership);

    await expect(resolver.resolve("u1", "c1")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("não duplica permissões entre base e dashboard", async () => {
    const { membershipRepository } = build();
    const membership = await seedMembership(membershipRepository, "u1", "c1", "GESTOR");
    membership.changePermissions(["kanban.manage"]);
    await membershipRepository.update(membership);

    const resolver = new MembershipPermissionResolver(
      membershipRepository,
      new DashboardPolicy({
        companyDefault: [],
        rolePermissions: { GESTOR: ["kanban.manage"] },
      }),
    );
    const actor = await resolver.resolve("u1", "c1");

    expect(actor.permissions.filter((permission) => permission === "kanban.manage")).toHaveLength(
      1,
    );
  });
});
