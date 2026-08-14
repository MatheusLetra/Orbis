import type { AppEnv } from "@/config/env";
import type { Database } from "@/infrastructure/database/client";
import { scryptPasswordHasher } from "@/infrastructure/security/scrypt-password-hasher";
import { AddFileAttachment } from "@/modules/attachments/application/use-cases/add-file-attachment";
import { AddLinkAttachment } from "@/modules/attachments/application/use-cases/add-link-attachment";
import { GetFileAttachment } from "@/modules/attachments/application/use-cases/get-file-attachment";
import { ListAttachments } from "@/modules/attachments/application/use-cases/list-attachments";
import { RemoveAttachment } from "@/modules/attachments/application/use-cases/remove-attachment";
import { DrizzleAttachmentBlobRepository } from "@/modules/attachments/infrastructure/repositories/drizzle-attachment-blob-repository";
import { DrizzleAttachmentRepository } from "@/modules/attachments/infrastructure/repositories/drizzle-attachment-repository";
import { DrizzleAttachmentUnitOfWork } from "@/modules/attachments/infrastructure/unit-of-work/drizzle-attachment-unit-of-work";
import { Login } from "@/modules/auth/application/use-cases/login";
import { Logout } from "@/modules/auth/application/use-cases/logout";
import { RefreshToken } from "@/modules/auth/application/use-cases/refresh-token";
import { DrizzleRefreshTokenRepository } from "@/modules/auth/infrastructure/repositories/drizzle-refresh-token-repository";
import { JoseTokenService } from "@/modules/auth/infrastructure/security/jose-token-service";
import { CalculateCapacity } from "@/modules/capacity/application/use-cases/calculate-capacity";
import { GetAvailableDevelopers } from "@/modules/capacity/application/use-cases/get-available-developers";
import { GetDailyHoursPerDeveloper } from "@/modules/capacity/application/use-cases/get-daily-hours-per-developer";
import { SetDailyHoursPerDeveloper } from "@/modules/capacity/application/use-cases/set-daily-hours-per-developer";
import { BusinessCalendar } from "@/modules/capacity/domain/services/business-calendar";
import { CapacityCalculator } from "@/modules/capacity/domain/services/capacity-calculator";
import { DrizzleCompanyCapacitySettingsRepository } from "@/modules/capacity/infrastructure/repositories/drizzle-company-capacity-settings-repository";
import { DrizzleDeveloperAvailabilityRepository } from "@/modules/capacity/infrastructure/repositories/drizzle-developer-availability-repository";
import { CreateCompany } from "@/modules/companies/application/use-cases/create-company";
import { GetCompany } from "@/modules/companies/application/use-cases/get-company";
import { ListCompanies } from "@/modules/companies/application/use-cases/list-companies";
import { UpdateCompany } from "@/modules/companies/application/use-cases/update-company";
import { DrizzleCompanyRepository } from "@/modules/companies/infrastructure/repositories/drizzle-company-repository";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { CreateMembership } from "@/modules/memberships/application/use-cases/create-membership";
import { ListCompanyMembers } from "@/modules/memberships/application/use-cases/list-company-members";
import { ListMemberships } from "@/modules/memberships/application/use-cases/list-memberships";
import { DrizzleCompanyMemberLookupRepository } from "@/modules/memberships/infrastructure/repositories/drizzle-company-member-lookup-repository";
import { DrizzleMembershipRepository } from "@/modules/memberships/infrastructure/repositories/drizzle-membership-repository";
import { MembershipPermissionResolver } from "@/modules/memberships/infrastructure/resolvers/membership-permission-resolver";
import type { PermissionResolver } from "@/modules/permissions/application/ports/permission-resolver";
import { AuthorizationService } from "@/modules/permissions/application/services/authorization-service";
import { CreateRelease } from "@/modules/releases/application/use-cases/create-release";
import { DeleteRelease } from "@/modules/releases/application/use-cases/delete-release";
import { GetRelease } from "@/modules/releases/application/use-cases/get-release";
import { ListReleases } from "@/modules/releases/application/use-cases/list-releases";
import { PublishRelease } from "@/modules/releases/application/use-cases/publish-release";
import { DrizzleReleaseRepository } from "@/modules/releases/infrastructure/repositories/drizzle-release-repository";
import { LocalArtifactStorage } from "@/modules/releases/infrastructure/storage/local-artifact-storage";
import { AddRequisitionAssignee } from "@/modules/requisitions/application/use-cases/add-requisition-assignee";
import { CreateRequisition } from "@/modules/requisitions/application/use-cases/create-requisition";
import { DeleteRequisition } from "@/modules/requisitions/application/use-cases/delete-requisition";
import { GetRequisition } from "@/modules/requisitions/application/use-cases/get-requisition";
import { ListRequisitionAssignees } from "@/modules/requisitions/application/use-cases/list-requisition-assignees";
import { ListRequisitions } from "@/modules/requisitions/application/use-cases/list-requisitions";
import { RemoveRequisitionAssignee } from "@/modules/requisitions/application/use-cases/remove-requisition-assignee";
import { UpdateRequisition } from "@/modules/requisitions/application/use-cases/update-requisition";
import { DrizzleRequisitionNumberGenerator } from "@/modules/requisitions/infrastructure/numbering/drizzle-requisition-number-generator";
import { DrizzleRequisitionAssigneeRepository } from "@/modules/requisitions/infrastructure/repositories/drizzle-requisition-assignee-repository";
import { DrizzleRequisitionRepository } from "@/modules/requisitions/infrastructure/repositories/drizzle-requisition-repository";
import { CreateSystem } from "@/modules/systems/application/use-cases/create-system";
import { DeleteSystem } from "@/modules/systems/application/use-cases/delete-system";
import { GetSystem } from "@/modules/systems/application/use-cases/get-system";
import { ListSystems } from "@/modules/systems/application/use-cases/list-systems";
import { UpdateSystem } from "@/modules/systems/application/use-cases/update-system";
import { DrizzleSystemRepository } from "@/modules/systems/infrastructure/repositories/drizzle-system-repository";
import { CreateTask } from "@/modules/tasks/application/use-cases/create-task";
import { GetTask } from "@/modules/tasks/application/use-cases/get-task";
import { ListTasks } from "@/modules/tasks/application/use-cases/list-tasks";
import { ListTimeEntries } from "@/modules/tasks/application/use-cases/list-time-entries";
import { RegisterTimeEntry } from "@/modules/tasks/application/use-cases/register-time-entry";
import { TransitionTaskStatus } from "@/modules/tasks/application/use-cases/transition-task-status";
import { UpdateTask } from "@/modules/tasks/application/use-cases/update-task";
import { DrizzleTaskRepository } from "@/modules/tasks/infrastructure/repositories/drizzle-task-repository";
import { DrizzleTaskStatusHistoryRepository } from "@/modules/tasks/infrastructure/repositories/drizzle-task-status-history-repository";
import { DrizzleTimeEntryRepository } from "@/modules/tasks/infrastructure/repositories/drizzle-time-entry-repository";
import { DrizzleTaskUnitOfWork } from "@/modules/tasks/infrastructure/unit-of-work/drizzle-task-unit-of-work";
import { GetMonthlyRequisitionTimeline } from "@/modules/timeline/application/use-cases/get-monthly-requisition-timeline";
import { GetWeeklyTimeline } from "@/modules/timeline/application/use-cases/get-weekly-timeline";
import { GetYearlyRequisitionTimeline } from "@/modules/timeline/application/use-cases/get-yearly-requisition-timeline";
import { DrizzleMonthlyRequisitionTimelineReadRepository } from "@/modules/timeline/infrastructure/repositories/drizzle-monthly-requisition-timeline-read-repository";
import { DrizzleWeeklyTimelineReadRepository } from "@/modules/timeline/infrastructure/repositories/drizzle-weekly-timeline-read-repository";
import { DrizzleYearlyRequisitionTimelineReadRepository } from "@/modules/timeline/infrastructure/repositories/drizzle-yearly-requisition-timeline-read-repository";
import { CreateUser } from "@/modules/users/application/use-cases/create-user";
import { DrizzleUserRepository } from "@/modules/users/infrastructure/repositories/drizzle-user-repository";
import { CreateSystemVersion } from "@/modules/versions/application/use-cases/create-system-version";
import { DeleteSystemVersion } from "@/modules/versions/application/use-cases/delete-system-version";
import { GetSystemVersion } from "@/modules/versions/application/use-cases/get-system-version";
import { ListSystemVersions } from "@/modules/versions/application/use-cases/list-system-versions";
import { UpdateSystemVersion } from "@/modules/versions/application/use-cases/update-system-version";
import { DrizzleSystemVersionRepository } from "@/modules/versions/infrastructure/repositories/drizzle-system-version-repository";
import { parseTtlToMs } from "@/shared/utils/ttl";

export interface OrbisModules {
  createUser: CreateUser;
  createCompany: CreateCompany;
  getCompany: GetCompany;
  listCompanies: ListCompanies;
  updateCompany: UpdateCompany;
  createMembership: CreateMembership;
  listMemberships: ListMemberships;
  listCompanyMembers: ListCompanyMembers;
  getAvailableDevelopers: GetAvailableDevelopers;
  calculateCapacity: CalculateCapacity;
  getDailyHoursPerDeveloper: GetDailyHoursPerDeveloper;
  setDailyHoursPerDeveloper: SetDailyHoursPerDeveloper;
  permissionResolver: PermissionResolver;
  tokenService: JoseTokenService;
  requisitions: {
    create: CreateRequisition;
    update: UpdateRequisition;
    list: ListRequisitions;
    get: GetRequisition;
    delete: DeleteRequisition;
    addAssignee: AddRequisitionAssignee;
    removeAssignee: RemoveRequisitionAssignee;
    listAssignees: ListRequisitionAssignees;
  };
  systems: {
    createSystem: CreateSystem;
    listSystems: ListSystems;
    getSystem: GetSystem;
    updateSystem: UpdateSystem;
    deleteSystem: DeleteSystem;
  };
  versions: {
    createSystemVersion: CreateSystemVersion;
    listSystemVersions: ListSystemVersions;
    getSystemVersion: GetSystemVersion;
    updateSystemVersion: UpdateSystemVersion;
    deleteSystemVersion: DeleteSystemVersion;
  };
  releases: {
    createRelease: CreateRelease;
    listReleases: ListReleases;
    getRelease: GetRelease;
    publishRelease: PublishRelease;
    deleteRelease: DeleteRelease;
  };
  tasks: {
    create: CreateTask;
    update: UpdateTask;
    transition: TransitionTaskStatus;
    list: ListTasks;
    get: GetTask;
    registerTimeEntry: RegisterTimeEntry;
    listTimeEntries: ListTimeEntries;
  };
  timeline: {
    getWeekly: GetWeeklyTimeline;
    getMonthly: GetMonthlyRequisitionTimeline;
    getYearly: GetYearlyRequisitionTimeline;
  };
  attachments: {
    addFile: AddFileAttachment;
    addLink: AddLinkAttachment;
    list: ListAttachments;
    getFile: GetFileAttachment;
    remove: RemoveAttachment;
  };
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
  const companyMemberLookupRepository = new DrizzleCompanyMemberLookupRepository(database);
  const developerAvailabilityRepository = new DrizzleDeveloperAvailabilityRepository(database);
  const companyCapacitySettingsRepository = new DrizzleCompanyCapacitySettingsRepository(database);
  const capacityCalculator = new CapacityCalculator(new BusinessCalendar());
  const refreshTokenRepository = new DrizzleRefreshTokenRepository(database);
  const systemRepository = new DrizzleSystemRepository(database);
  const systemVersionRepository = new DrizzleSystemVersionRepository(database);
  const releaseRepository = new DrizzleReleaseRepository(database);
  const requisitionRepository = new DrizzleRequisitionRepository(database);
  const requisitionAssigneeRepository = new DrizzleRequisitionAssigneeRepository(database);
  const requisitionNumberGenerator = new DrizzleRequisitionNumberGenerator(database);
  const taskRepository = new DrizzleTaskRepository(database);
  const taskStatusHistoryRepository = new DrizzleTaskStatusHistoryRepository(database);
  const timeEntryRepository = new DrizzleTimeEntryRepository(database);
  const taskUnitOfWork = new DrizzleTaskUnitOfWork(database);
  const weeklyTimelineReadRepository = new DrizzleWeeklyTimelineReadRepository(database);
  const monthlyRequisitionTimelineReadRepository =
    new DrizzleMonthlyRequisitionTimelineReadRepository(database);
  const yearlyRequisitionTimelineReadRepository =
    new DrizzleYearlyRequisitionTimelineReadRepository(database);
  const attachmentRepository = new DrizzleAttachmentRepository(database);
  const attachmentBlobRepository = new DrizzleAttachmentBlobRepository(database);
  const attachmentUnitOfWork = new DrizzleAttachmentUnitOfWork(database);

  const accessService = new MembershipAccessService(membershipRepository);
  const authorization = new AuthorizationService();
  const permissionResolver = new MembershipPermissionResolver(membershipRepository);
  const artifactStorage = new LocalArtifactStorage(env.ARTIFACT_STORAGE_PATH);
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
    listCompanyMembers: new ListCompanyMembers(
      companyMemberLookupRepository,
      accessService,
      authorization,
    ),
    getAvailableDevelopers: new GetAvailableDevelopers(
      developerAvailabilityRepository,
      companyRepository,
      accessService,
      authorization,
    ),
    calculateCapacity: new CalculateCapacity(
      developerAvailabilityRepository,
      companyCapacitySettingsRepository,
      companyRepository,
      accessService,
      authorization,
      capacityCalculator,
    ),
    getDailyHoursPerDeveloper: new GetDailyHoursPerDeveloper(
      companyCapacitySettingsRepository,
      companyRepository,
      accessService,
      authorization,
    ),
    setDailyHoursPerDeveloper: new SetDailyHoursPerDeveloper(
      companyCapacitySettingsRepository,
      companyRepository,
      accessService,
      authorization,
    ),
    permissionResolver,
    tokenService,
    requisitions: {
      create: new CreateRequisition(
        requisitionRepository,
        requisitionNumberGenerator,
        membershipRepository,
        systemRepository,
        systemVersionRepository,
        accessService,
        authorization,
      ),
      update: new UpdateRequisition(
        requisitionRepository,
        membershipRepository,
        systemRepository,
        systemVersionRepository,
        accessService,
        authorization,
      ),
      list: new ListRequisitions(requisitionRepository, accessService, authorization),
      get: new GetRequisition(
        requisitionRepository,
        requisitionAssigneeRepository,
        accessService,
        authorization,
      ),
      delete: new DeleteRequisition(requisitionRepository, accessService, authorization),
      addAssignee: new AddRequisitionAssignee(
        requisitionRepository,
        requisitionAssigneeRepository,
        membershipRepository,
        accessService,
        authorization,
      ),
      removeAssignee: new RemoveRequisitionAssignee(
        requisitionRepository,
        requisitionAssigneeRepository,
        accessService,
        authorization,
      ),
      listAssignees: new ListRequisitionAssignees(
        requisitionRepository,
        requisitionAssigneeRepository,
        accessService,
        authorization,
      ),
    },
    systems: {
      createSystem: new CreateSystem(systemRepository, accessService, authorization),
      listSystems: new ListSystems(systemRepository, accessService, authorization),
      getSystem: new GetSystem(systemRepository, accessService, authorization),
      updateSystem: new UpdateSystem(systemRepository, accessService, authorization),
      deleteSystem: new DeleteSystem(systemRepository, accessService, authorization),
    },
    versions: {
      createSystemVersion: new CreateSystemVersion(
        systemVersionRepository,
        systemRepository,
        accessService,
        authorization,
      ),
      listSystemVersions: new ListSystemVersions(
        systemVersionRepository,
        systemRepository,
        accessService,
        authorization,
      ),
      getSystemVersion: new GetSystemVersion(systemVersionRepository, accessService, authorization),
      updateSystemVersion: new UpdateSystemVersion(
        systemVersionRepository,
        accessService,
        authorization,
      ),
      deleteSystemVersion: new DeleteSystemVersion(
        systemVersionRepository,
        accessService,
        authorization,
      ),
    },
    releases: {
      createRelease: new CreateRelease(
        releaseRepository,
        systemVersionRepository,
        accessService,
        authorization,
      ),
      listReleases: new ListReleases(releaseRepository, accessService, authorization),
      getRelease: new GetRelease(releaseRepository, accessService, authorization),
      publishRelease: new PublishRelease(
        releaseRepository,
        artifactStorage,
        accessService,
        authorization,
      ),
      deleteRelease: new DeleteRelease(releaseRepository, accessService, authorization),
    },
    tasks: {
      create: new CreateTask(
        taskUnitOfWork,
        membershipRepository,
        requisitionRepository,
        accessService,
        authorization,
      ),
      update: new UpdateTask(
        taskUnitOfWork,
        membershipRepository,
        requisitionRepository,
        accessService,
        authorization,
      ),
      transition: new TransitionTaskStatus(taskUnitOfWork, accessService, authorization),
      list: new ListTasks(taskRepository, accessService, authorization),
      get: new GetTask(taskRepository, taskStatusHistoryRepository, accessService, authorization),
      registerTimeEntry: new RegisterTimeEntry(taskUnitOfWork, accessService, authorization),
      listTimeEntries: new ListTimeEntries(
        taskRepository,
        timeEntryRepository,
        accessService,
        authorization,
      ),
    },
    timeline: {
      getWeekly: new GetWeeklyTimeline(
        weeklyTimelineReadRepository,
        companyRepository,
        accessService,
        authorization,
      ),
      getMonthly: new GetMonthlyRequisitionTimeline(
        monthlyRequisitionTimelineReadRepository,
        companyRepository,
        accessService,
        authorization,
      ),
      getYearly: new GetYearlyRequisitionTimeline(
        yearlyRequisitionTimelineReadRepository,
        companyRepository,
        accessService,
        authorization,
      ),
    },
    attachments: {
      addFile: new AddFileAttachment(
        attachmentUnitOfWork,
        requisitionRepository,
        taskRepository,
        accessService,
        authorization,
      ),
      addLink: new AddLinkAttachment(
        attachmentRepository,
        requisitionRepository,
        taskRepository,
        accessService,
        authorization,
      ),
      list: new ListAttachments(
        attachmentRepository,
        requisitionRepository,
        taskRepository,
        accessService,
        authorization,
      ),
      getFile: new GetFileAttachment(
        attachmentRepository,
        attachmentBlobRepository,
        requisitionRepository,
        taskRepository,
        accessService,
        authorization,
      ),
      remove: new RemoveAttachment(
        attachmentRepository,
        requisitionRepository,
        taskRepository,
        accessService,
        authorization,
      ),
    },
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
