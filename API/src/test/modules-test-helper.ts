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
import { MembershipPermissionResolver } from "@/modules/memberships/infrastructure/resolvers/membership-permission-resolver";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { CreateRelease } from "@/modules/releases/application/use-cases/create-release";
import { DeleteRelease } from "@/modules/releases/application/use-cases/delete-release";
import { GetRelease } from "@/modules/releases/application/use-cases/get-release";
import { ListReleases } from "@/modules/releases/application/use-cases/list-releases";
import { PublishRelease } from "@/modules/releases/application/use-cases/publish-release";
import { AddRequisitionAssignee } from "@/modules/requisitions/application/use-cases/add-requisition-assignee";
import { CreateRequisition } from "@/modules/requisitions/application/use-cases/create-requisition";
import { DeleteRequisition } from "@/modules/requisitions/application/use-cases/delete-requisition";
import { GetRequisition } from "@/modules/requisitions/application/use-cases/get-requisition";
import { ListRequisitionAssignees } from "@/modules/requisitions/application/use-cases/list-requisition-assignees";
import { ListRequisitions } from "@/modules/requisitions/application/use-cases/list-requisitions";
import { RemoveRequisitionAssignee } from "@/modules/requisitions/application/use-cases/remove-requisition-assignee";
import { UpdateRequisition } from "@/modules/requisitions/application/use-cases/update-requisition";
import { CreateSystem } from "@/modules/systems/application/use-cases/create-system";
import { DeleteSystem } from "@/modules/systems/application/use-cases/delete-system";
import { GetSystem } from "@/modules/systems/application/use-cases/get-system";
import { ListSystems } from "@/modules/systems/application/use-cases/list-systems";
import { UpdateSystem } from "@/modules/systems/application/use-cases/update-system";
import { CreateUser } from "@/modules/users/application/use-cases/create-user";
import { CreateSystemVersion } from "@/modules/versions/application/use-cases/create-system-version";
import { DeleteSystemVersion } from "@/modules/versions/application/use-cases/delete-system-version";
import { GetSystemVersion } from "@/modules/versions/application/use-cases/get-system-version";
import { ListSystemVersions } from "@/modules/versions/application/use-cases/list-system-versions";
import { UpdateSystemVersion } from "@/modules/versions/application/use-cases/update-system-version";
import {
  InMemoryArtifactStorage,
  InMemoryReleaseRepository,
  InMemorySystemRepository,
  InMemorySystemVersionRepository,
} from "./fakes/catalog-fakes";
import {
  fakePasswordHasher,
  InMemoryCompanyRepository,
  InMemoryMembershipRepository,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
} from "./fakes/identity-fakes";
import {
  FakeRequisitionNumberGenerator,
  InMemoryRequisitionAssigneeRepository,
  InMemoryRequisitionRepository,
} from "./fakes/requisition-fakes";

const TEST_ACCESS_SECRET = "test-access-secret-com-pelo-menos-32-caracteres-000";
const TEST_REFRESH_SECRET = "test-refresh-secret-com-pelo-menos-32-caracteres-000";
const TEST_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface TestModules extends Omit<OrbisModules, "requisitions"> {
  requisitions: OrbisModules["requisitions"];
  repositories: {
    users: InMemoryUserRepository;
    companies: InMemoryCompanyRepository;
    memberships: InMemoryMembershipRepository;
    refreshTokens: InMemoryRefreshTokenRepository;
    systems: InMemorySystemRepository;
    systemVersions: InMemorySystemVersionRepository;
    releases: InMemoryReleaseRepository;
    requisitions: InMemoryRequisitionRepository;
    requisitionAssignees: InMemoryRequisitionAssigneeRepository;
  };
  artifactStorage: InMemoryArtifactStorage;
}

export function buildTestModules(): TestModules {
  const users = new InMemoryUserRepository();
  const companies = new InMemoryCompanyRepository();
  const memberships = new InMemoryMembershipRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const systems = new InMemorySystemRepository();
  const systemVersions = new InMemorySystemVersionRepository();
  const releases = new InMemoryReleaseRepository();
  const artifactStorage = new InMemoryArtifactStorage();
  const requisitions = new InMemoryRequisitionRepository();
  const requisitionAssignees = new InMemoryRequisitionAssigneeRepository();
  const requisitionNumberGenerator = new FakeRequisitionNumberGenerator();
  const accessService = new MembershipAccessService(memberships);
  const authorization = new AuthorizationService();
  const permissionResolver = new MembershipPermissionResolver(memberships);
  const tokenService = new JoseTokenService({
    accessSecret: TEST_ACCESS_SECRET,
    refreshSecret: TEST_REFRESH_SECRET,
    accessTokenTtl: "15m",
    refreshTokenTtl: "30d",
  });

  return {
    repositories: {
      users,
      companies,
      memberships,
      refreshTokens,
      systems,
      systemVersions,
      releases,
      requisitions,
      requisitionAssignees,
    },
    artifactStorage,
    createUser: new CreateUser(users, fakePasswordHasher),
    createCompany: new CreateCompany(companies, memberships),
    getCompany: new GetCompany(companies, accessService, authorization),
    listCompanies: new ListCompanies(companies),
    updateCompany: new UpdateCompany(companies, accessService, authorization),
    createMembership: new CreateMembership(
      memberships,
      companies,
      users,
      accessService,
      authorization,
    ),
    listMemberships: new ListMemberships(memberships),
    permissionResolver,
    tokenService,
    requisitions: {
      create: new CreateRequisition(
        requisitions,
        requisitionNumberGenerator,
        memberships,
        systems,
        systemVersions,
        accessService,
        authorization,
      ),
      update: new UpdateRequisition(
        requisitions,
        memberships,
        systems,
        systemVersions,
        accessService,
        authorization,
      ),
      list: new ListRequisitions(requisitions, accessService, authorization),
      get: new GetRequisition(requisitions, requisitionAssignees, accessService, authorization),
      delete: new DeleteRequisition(requisitions, accessService, authorization),
      addAssignee: new AddRequisitionAssignee(
        requisitions,
        requisitionAssignees,
        memberships,
        accessService,
        authorization,
      ),
      removeAssignee: new RemoveRequisitionAssignee(
        requisitions,
        requisitionAssignees,
        accessService,
        authorization,
      ),
      listAssignees: new ListRequisitionAssignees(
        requisitions,
        requisitionAssignees,
        accessService,
        authorization,
      ),
    },
    systems: {
      createSystem: new CreateSystem(systems, accessService, authorization),
      listSystems: new ListSystems(systems, accessService, authorization),
      getSystem: new GetSystem(systems, accessService, authorization),
      updateSystem: new UpdateSystem(systems, accessService, authorization),
      deleteSystem: new DeleteSystem(systems, accessService, authorization),
    },
    versions: {
      createSystemVersion: new CreateSystemVersion(
        systemVersions,
        systems,
        accessService,
        authorization,
      ),
      listSystemVersions: new ListSystemVersions(
        systemVersions,
        systems,
        accessService,
        authorization,
      ),
      getSystemVersion: new GetSystemVersion(systemVersions, accessService, authorization),
      updateSystemVersion: new UpdateSystemVersion(systemVersions, accessService, authorization),
      deleteSystemVersion: new DeleteSystemVersion(systemVersions, accessService, authorization),
    },
    releases: {
      createRelease: new CreateRelease(releases, systemVersions, accessService, authorization),
      listReleases: new ListReleases(releases, accessService, authorization),
      getRelease: new GetRelease(releases, accessService, authorization),
      publishRelease: new PublishRelease(releases, artifactStorage, accessService, authorization),
      deleteRelease: new DeleteRelease(releases, accessService, authorization),
    },
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
