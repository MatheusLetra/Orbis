import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/infrastructure/database/client";
import { DrizzleRefreshTokenRepository } from "@/modules/auth/infrastructure/repositories/drizzle-refresh-token-repository";
import { Company } from "@/modules/companies/domain/entities/company";
import { DrizzleCompanyRepository } from "@/modules/companies/infrastructure/repositories/drizzle-company-repository";
import { Membership } from "@/modules/memberships/domain/entities/membership";
import { DrizzleMembershipRepository } from "@/modules/memberships/infrastructure/repositories/drizzle-membership-repository";
import { User } from "@/modules/users/domain/entities/user";
import { DrizzleUserRepository } from "@/modules/users/infrastructure/repositories/drizzle-user-repository";
import {
  createTestDatabase,
  isTestDatabaseAvailable,
  resetIdentityTables,
} from "@/test/db-test-helper";

const available = await isTestDatabaseAvailable();

describe.skipIf(!available)("repositórios de identidade (drizzle + PostgreSQL)", () => {
  let db: Database;
  let companyRepository: DrizzleCompanyRepository;
  let userRepository: DrizzleUserRepository;
  let membershipRepository: DrizzleMembershipRepository;
  let refreshTokenRepository: DrizzleRefreshTokenRepository;

  beforeAll(async () => {
    db = await createTestDatabase();
    companyRepository = new DrizzleCompanyRepository(db);
    userRepository = new DrizzleUserRepository(db);
    membershipRepository = new DrizzleMembershipRepository(db);
    refreshTokenRepository = new DrizzleRefreshTokenRepository(db);
  });

  beforeEach(async () => {
    await resetIdentityTables(db);
  });

  afterAll(async () => {
    await db.$client.end();
  });

  describe("CompanyRepository", () => {
    it("persiste e recupera uma empresa", async () => {
      const company = Company.create({ name: "Orbis Corp", timezone: "America/Sao_Paulo" });

      const created = await companyRepository.create(company);
      const found = await companyRepository.findById(created.id);

      expect(created.id).toBe(company.id);
      expect(found?.name).toBe("Orbis Corp");
      expect(found?.timezone).toBe("America/Sao_Paulo");
    });

    it("retorna null quando a empresa não existe", async () => {
      expect(await companyRepository.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("atualiza a empresa", async () => {
      const company = await companyRepository.create(Company.create({ name: "Antiga" }));
      company.rename("Nova");

      const updated = await companyRepository.update(company);

      expect(updated.name).toBe("Nova");
    });

    it("lista empresas apenas de usuários com membership ativa", async () => {
      const companyA = await companyRepository.create(Company.create({ name: "A" }));
      const companyB = await companyRepository.create(Company.create({ name: "B" }));
      const user = await userRepository.create(
        User.create({ email: "dev@orbis.com", name: "Ana", passwordHash: "scrypt:x" }),
      );
      await membershipRepository.create(
        Membership.create({ companyId: companyA.id, userId: user.id, position: "GESTOR" }),
      );
      await membershipRepository.create(
        Membership.create({ companyId: companyB.id, userId: user.id, position: "SUPORTE" }),
      );

      const companies = await companyRepository.findByUser(user.id);

      expect(companies.map((c) => c.name).sort()).toEqual(["A", "B"]);
    });

    it("não lista empresas sem membership ativa", async () => {
      const companyA = await companyRepository.create(Company.create({ name: "A" }));
      const user = await userRepository.create(
        User.create({ email: "dev2@orbis.com", name: "Ana", passwordHash: "scrypt:x" }),
      );
      const membership = Membership.create({
        companyId: companyA.id,
        userId: user.id,
        position: "GESTOR",
      });
      membership.deactivate();
      await membershipRepository.create(membership);

      expect(await companyRepository.findByUser(user.id)).toEqual([]);
    });
  });

  describe("UserRepository", () => {
    it("persiste e recupera usuário por id e e-mail", async () => {
      const user = User.create({
        email: "dev@orbis.com",
        name: "Ana Dev",
        passwordHash: "scrypt:abc",
      });

      const created = await userRepository.create(user);

      expect((await userRepository.findById(created.id))?.name).toBe("Ana Dev");
      expect((await userRepository.findByEmail("dev@orbis.com"))?.id).toBe(created.id);
    });

    it("retorna null quando não encontra usuário", async () => {
      expect(await userRepository.findByEmail("ninguem@orbis.com")).toBeNull();
    });

    it("atualiza o usuário", async () => {
      const user = await userRepository.create(
        User.create({ email: "dev@orbis.com", name: "Ana", passwordHash: "scrypt:a" }),
      );
      user.rename("Ana Souza");

      const updated = await userRepository.update(user);

      expect(updated.name).toBe("Ana Souza");
    });
  });

  describe("MembershipRepository", () => {
    it("persiste e recupera membership por usuário e empresa", async () => {
      const company = await companyRepository.create(Company.create({ name: "Orbis" }));
      const user = await userRepository.create(
        User.create({ email: "dev@orbis.com", name: "Ana", passwordHash: "scrypt:x" }),
      );
      const membership = await membershipRepository.create(
        Membership.create({ companyId: company.id, userId: user.id, position: "DESENVOLVEDOR" }),
      );

      const found = await membershipRepository.findByUserAndCompany(user.id, company.id);

      expect(found?.id).toBe(membership.id);
      expect(found?.position).toBe("DESENVOLVEDOR");
    });

    it("isola memberships entre tenants", async () => {
      const companyA = await companyRepository.create(Company.create({ name: "Tenant A" }));
      const companyB = await companyRepository.create(Company.create({ name: "Tenant B" }));
      const userA = await userRepository.create(
        User.create({ email: "a@orbis.com", name: "A", passwordHash: "scrypt:x" }),
      );
      const userB = await userRepository.create(
        User.create({ email: "b@orbis.com", name: "B", passwordHash: "scrypt:x" }),
      );
      await membershipRepository.create(
        Membership.create({ companyId: companyA.id, userId: userA.id, position: "GESTOR" }),
      );

      expect(await membershipRepository.findByUserAndCompany(userA.id, companyB.id)).toBeNull();
      expect(await membershipRepository.findByUserAndCompany(userB.id, companyA.id)).toBeNull();
      expect(await membershipRepository.listByUser(userA.id)).toHaveLength(1);
      expect(await membershipRepository.listByUser(userB.id)).toHaveLength(0);
      expect(await membershipRepository.listByCompany(companyB.id)).toHaveLength(0);
    });

    it("atualiza membership (cargo/status)", async () => {
      const company = await companyRepository.create(Company.create({ name: "Orbis" }));
      const user = await userRepository.create(
        User.create({ email: "dev@orbis.com", name: "Ana", passwordHash: "scrypt:x" }),
      );
      const membership = await membershipRepository.create(
        Membership.create({ companyId: company.id, userId: user.id, position: "SUPORTE" }),
      );
      membership.changePosition("GESTOR");
      membership.deactivate();

      const updated = await membershipRepository.update(membership);

      expect(updated.position).toBe("GESTOR");
      expect(updated.isActive).toBe(false);
    });
  });

  describe("RefreshTokenRepository", () => {
    it("cria e encontra refresh token por hash", async () => {
      const user = await userRepository.create(
        User.create({ email: "rt@orbis.com", name: "Ana", passwordHash: "scrypt:x" }),
      );
      const record = {
        id: "11111111-1111-4111-8111-111111111111",
        userId: user.id,
        tokenHash: "hash-do-token",
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        replacedById: null,
        createdAt: new Date(),
      };

      await refreshTokenRepository.create(record);
      const found = await refreshTokenRepository.findByTokenHash("hash-do-token");

      expect(found?.id).toBe(record.id);
      expect(found?.userId).toBe(user.id);
      expect(found?.revokedAt).toBeNull();
    });

    it("retorna null quando o hash não existe", async () => {
      expect(await refreshTokenRepository.findByTokenHash("hash-inexistente")).toBeNull();
    });

    it("revoga o token e registra a substituição", async () => {
      const user = await userRepository.create(
        User.create({ email: "rt2@orbis.com", name: "Ana", passwordHash: "scrypt:x" }),
      );
      await refreshTokenRepository.create({
        id: "22222222-2222-4222-8222-222222222222",
        userId: user.id,
        tokenHash: "hash-antigo",
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        replacedById: null,
        createdAt: new Date(),
      });

      await refreshTokenRepository.create({
        id: "33333333-3333-4333-8333-333333333333",
        userId: user.id,
        tokenHash: "hash-novo",
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        replacedById: null,
        createdAt: new Date(),
      });
      await refreshTokenRepository.revoke(
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
      );

      const found = await refreshTokenRepository.findByTokenHash("hash-antigo");
      expect(found?.revokedAt).not.toBeNull();
      expect(found?.replacedById).toBe("33333333-3333-4333-8333-333333333333");
    });
  });
});
