import { describe, expect, it, vi } from "vitest";
import { GetAvailableDevelopers } from "@/modules/capacity/application/use-cases/get-available-developers";
import { Company } from "@/modules/companies/domain/entities/company";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { User } from "@/modules/users/domain/entities/user";
import type { AuthenticatedUser } from "@/shared/application/authenticated-user";
import { ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors/typed-errors";
import { InMemoryDeveloperAvailabilityRepository } from "@/test/fakes/capacity-fakes";
import {
  InMemoryCompanyRepository,
  InMemoryMembershipRepository,
  InMemoryUserRepository,
} from "@/test/fakes/identity-fakes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function actor(
  permissions: AuthenticatedUser["permissions"] = ["capacity.read"],
): AuthenticatedUser {
  return { userId: USER_ID, companyId: COMPANY_ID, permissions };
}

async function build() {
  const companies = new InMemoryCompanyRepository();
  const memberships = new InMemoryMembershipRepository();
  const users = new InMemoryUserRepository();
  await companies.create(Company.create({ name: "Orbis" }, COMPANY_ID));
  await users.create(
    User.create({ email: "actor@example.com", name: "Actor", passwordHash: "hash" }, USER_ID),
  );
  await memberships.create(
    Membership.create({ companyId: COMPANY_ID, userId: USER_ID, position: "GESTOR" }),
  );
  const company = await companies.findById(COMPANY_ID);
  if (!company) throw new Error("Empresa de teste não criada");

  return {
    companies,
    memberships,
    users,
    repository: new InMemoryDeveloperAvailabilityRepository(companies, memberships, users),
    company,
  };
}

async function addUser(
  context: Awaited<ReturnType<typeof build>>,
  userId: string,
  isActive = true,
): Promise<void> {
  const user = User.create(
    { email: `${userId}@example.com`, name: userId, passwordHash: "hash" },
    userId,
  );
  if (!isActive) user.deactivate();
  await context.users.create(user);
}

async function addMembership(
  context: Awaited<ReturnType<typeof build>>,
  userId: string,
  position = "DESENVOLVEDOR",
  isActive = true,
): Promise<void> {
  const membership = Membership.create({ companyId: COMPANY_ID, userId, position });
  if (!isActive) membership.deactivate();
  await context.memberships.create(membership);
}

function useCase(context: Awaited<ReturnType<typeof build>>): GetAvailableDevelopers {
  return new GetAvailableDevelopers(
    context.repository,
    context.companies,
    new MembershipAccessService(context.memberships),
    new AuthorizationService(),
  );
}

describe("GetAvailableDevelopers", () => {
  it("retorna zero quando não há desenvolvedores elegíveis", async () => {
    const context = await build();

    await expect(
      useCase(context).execute({ actor: actor(), companyId: COMPANY_ID }),
    ).resolves.toEqual({
      companyId: COMPANY_ID,
      availableDevelopers: 0,
    });
  });

  it("conta um e múltiplos desenvolvedores elegíveis", async () => {
    const context = await build();
    await addUser(context, USER_ID);
    await addMembership(context, USER_ID);
    await addUser(context, "33333333-3333-4333-8333-333333333333");
    await addMembership(context, "33333333-3333-4333-8333-333333333333");

    await expect(
      useCase(context).execute({ actor: actor(), companyId: COMPANY_ID }),
    ).resolves.toMatchObject({
      availableDevelopers: 2,
    });
  });

  it.each([
    ["membership inativa", { isActive: false }, true, "DESENVOLVEDOR"],
    ["usuário inativo", { isActive: true }, false, "DESENVOLVEDOR"],
    ["posição diferente", { isActive: true }, true, "SUPORTE"],
  ])("exclui %s", async (_label, membershipOptions, userActive, position) => {
    const context = await build();
    await addUser(context, USER_ID, userActive);
    await addMembership(context, USER_ID, position, membershipOptions.isActive);

    await expect(
      useCase(context).execute({ actor: actor(), companyId: COMPANY_ID }),
    ).resolves.toMatchObject({
      availableDevelopers: 0,
    });
  });

  it("exige capacity.read e membership ativa do ator", async () => {
    const context = await build();
    await addUser(context, USER_ID);
    await addMembership(context, USER_ID, "GESTOR");
    const command = { actor: actor(["tasks.read"]), companyId: COMPANY_ID };

    await expect(useCase(context).execute(command)).rejects.toBeInstanceOf(ForbiddenError);
    const activeMembership = await context.memberships.findByUserAndCompany(USER_ID, COMPANY_ID);
    activeMembership?.deactivate();
    if (activeMembership) await context.memberships.update(activeMembership);

    await expect(
      useCase(context).execute({ actor: actor(), companyId: COMPANY_ID }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejeita empresa inexistente, inativa, inválida e contexto cross-tenant", async () => {
    const context = await build();
    const get = useCase(context);
    const missingCompanyId = "99999999-9999-4999-8999-999999999999";
    await context.memberships.create(
      Membership.create({ companyId: missingCompanyId, userId: USER_ID, position: "GESTOR" }),
    );

    await expect(
      get.execute({
        actor: { ...actor(), companyId: missingCompanyId },
        companyId: missingCompanyId,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    context.company.deactivate();
    await context.companies.update(context.company);
    await expect(get.execute({ actor: actor(), companyId: COMPANY_ID })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(get.execute({ actor: actor(), companyId: "not-an-uuid" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      get.execute({
        actor: { ...actor(), companyId: "33333333-3333-4333-8333-333333333333" },
        companyId: COMPANY_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("não passa actor ao repository nem calcula capacidade", async () => {
    const context = await build();
    await addUser(context, USER_ID);
    await addMembership(context, USER_ID, "GESTOR");
    const count = vi.spyOn(context.repository, "countAvailableDevelopers");

    const result = await useCase(context).execute({ actor: actor(), companyId: COMPANY_ID });

    expect(count).toHaveBeenCalledWith(COMPANY_ID);
    expect(result).toEqual({ companyId: COMPANY_ID, availableDevelopers: 0 });
  });
});
