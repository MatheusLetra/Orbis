import type { AppEnv } from "@/config/env";
import type { Database } from "@/infrastructure/database/client";
import { scryptPasswordHasher } from "@/infrastructure/security/scrypt-password-hasher";
import { Login } from "@/modules/auth/application/use-cases/login";
import { Logout } from "@/modules/auth/application/use-cases/logout";
import { RefreshToken } from "@/modules/auth/application/use-cases/refresh-token";
import { DrizzleRefreshTokenRepository } from "@/modules/auth/infrastructure/repositories/drizzle-refresh-token-repository";
import { JoseTokenService } from "@/modules/auth/infrastructure/security/jose-token-service";
import { CreateCompany } from "@/modules/companies/application/use-cases/create-company";
import { GetCompany } from "@/modules/companies/application/use-cases/get-company";
import { ListCompanies } from "@/modules/companies/application/use-cases/list-companies";
import { UpdateCompany } from "@/modules/companies/application/use-cases/update-company";
import { DrizzleCompanyRepository } from "@/modules/companies/infrastructure/repositories/drizzle-company-repository";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { CreateMembership } from "@/modules/memberships/application/use-cases/create-membership";
import { ListMemberships } from "@/modules/memberships/application/use-cases/list-memberships";
import { DrizzleMembershipRepository } from "@/modules/memberships/infrastructure/repositories/drizzle-membership-repository";
import { MembershipPermissionResolver } from "@/modules/memberships/infrastructure/resolvers/membership-permission-resolver";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { CreateUser } from "@/modules/users/application/use-cases/create-user";
import { DrizzleUserRepository } from "@/modules/users/infrastructure/repositories/drizzle-user-repository";
import { parseTtlToMs } from "@/shared/utils/ttl";

export interface OrbisModules {
  createUser: CreateUser;
  createCompany: CreateCompany;
  getCompany: GetCompany;
  listCompanies: ListCompanies;
  updateCompany: UpdateCompany;
  createMembership: CreateMembership;
  listMemberships: ListMemberships;
  permissionResolver: PermissionResolver;
  tokenService: JoseTokenService;
  auth: {
    login: Login;
    refreshToken: RefreshToken;
    logout: Logout;
  };
}

export function buildModules(database: Database, env: AppEnv): OrbisModules {
  const userRepository = new DrizzleUserRepository(database);
  const companyRepository = new DrizzleCompanyRepository(database);
  const membershipRepository = new DrizzleMembershipRepository(database);
  const refreshTokenRepository = new DrizzleRefreshTokenRepository(database);

  const accessService = new MembershipAccessService(membershipRepository);
  const authorization = new AuthorizationService();
  const permissionResolver = new MembershipPermissionResolver(membershipRepository);
  const tokenService = new JoseTokenService({
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTokenTtl: env.JWT_ACCESS_TTL,
    refreshTokenTtl: env.JWT_REFRESH_TTL,
  });
  const refreshTokenTtlMs = parseTtlToMs(env.JWT_REFRESH_TTL);

  return {
    createUser: new CreateUser(userRepository, scryptPasswordHasher),
    createCompany: new CreateCompany(companyRepository, membershipRepository),
    getCompany: new GetCompany(companyRepository, accessService, authorization),
    listCompanies: new ListCompanies(companyRepository),
    updateCompany: new UpdateCompany(companyRepository, accessService, authorization),
    createMembership: new CreateMembership(
      membershipRepository,
      companyRepository,
      userRepository,
      accessService,
      authorization,
    ),
    listMemberships: new ListMemberships(membershipRepository),
    permissionResolver,
    tokenService,
    auth: {
      login: new Login(userRepository, scryptPasswordHasher, tokenService, refreshTokenRepository, {
        refreshTokenTtlMs,
      }),
      refreshToken: new RefreshToken(tokenService, refreshTokenRepository, {
        refreshTokenTtlMs,
      }),
      logout: new Logout(tokenService, refreshTokenRepository),
    },
  };
}
