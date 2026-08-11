import type { OrbisModules } from "@/infrastructure/composition-root";
import { Login } from "@/modules/auth/application/use-cases/login";
import { Logout } from "@/modules/auth/application/use-cases/logout";
import { RefreshToken } from "@/modules/auth/application/use-cases/refresh-token";
import { JoseTokenService } from "@/modules/auth/infrastructure/security/jose-token-service";
import { CreateCompany } from "@/modules/companies/application/use-cases/create-company";
import { GetCompany } from "@/modules/companies/application/use-cases/get-company";
import { ListCompanies } from "@/modules/companies/application/use-cases/list-companies";
import { UpdateCompany } from "@/modules/companies/application/use-cases/update-company";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { CreateMembership } from "@/modules/memberships/application/use-cases/create-membership";
import { ListMemberships } from "@/modules/memberships/application/use-cases/list-memberships";
import { CreateUser } from "@/modules/users/application/use-cases/create-user";
import {
  fakePasswordHasher,
  InMemoryCompanyRepository,
  InMemoryMembershipRepository,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
} from "./fakes/identity-fakes";

const TEST_ACCESS_SECRET = "test-access-secret-com-pelo-menos-32-caracteres-000";
const TEST_REFRESH_SECRET = "test-refresh-secret-com-pelo-menos-32-caracteres-000";
const TEST_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface TestModules extends OrbisModules {
  repositories: {
    users: InMemoryUserRepository;
    companies: InMemoryCompanyRepository;
    memberships: InMemoryMembershipRepository;
    refreshTokens: InMemoryRefreshTokenRepository;
  };
}

export function buildTestModules(): TestModules {
  const users = new InMemoryUserRepository();
  const companies = new InMemoryCompanyRepository();
  const memberships = new InMemoryMembershipRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const accessService = new MembershipAccessService(memberships);
  const tokenService = new JoseTokenService({
    accessSecret: TEST_ACCESS_SECRET,
    refreshSecret: TEST_REFRESH_SECRET,
    accessTokenTtl: "15m",
    refreshTokenTtl: "30d",
  });

  return {
    repositories: { users, companies, memberships, refreshTokens },
    createUser: new CreateUser(users, fakePasswordHasher),
    createCompany: new CreateCompany(companies, memberships),
    getCompany: new GetCompany(companies, accessService),
    listCompanies: new ListCompanies(companies),
    updateCompany: new UpdateCompany(companies, accessService),
    createMembership: new CreateMembership(memberships, companies, users),
    listMemberships: new ListMemberships(memberships),
    tokenService,
    auth: {
      login: new Login(users, fakePasswordHasher, tokenService, refreshTokens, {
        refreshTokenTtlMs: TEST_REFRESH_TTL_MS,
      }),
      refreshToken: new RefreshToken(tokenService, refreshTokens, {
        refreshTokenTtlMs: TEST_REFRESH_TTL_MS,
      }),
      logout: new Logout(tokenService, refreshTokens),
    },
  };
}
