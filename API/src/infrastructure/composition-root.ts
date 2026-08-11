import { CreateCompany } from "@/modules/companies/application/use-cases/create-company";
import { GetCompany } from "@/modules/companies/application/use-cases/get-company";
import { ListCompanies } from "@/modules/companies/application/use-cases/list-companies";
import { UpdateCompany } from "@/modules/companies/application/use-cases/update-company";
import { DrizzleCompanyRepository } from "@/modules/companies/infrastructure/repositories/drizzle-company-repository";
import { MembershipAccessService } from "@/modules/memberships/application/services/membership-access-service";
import { CreateMembership } from "@/modules/memberships/application/use-cases/create-membership";
import { ListMemberships } from "@/modules/memberships/application/use-cases/list-memberships";
import { DrizzleMembershipRepository } from "@/modules/memberships/infrastructure/repositories/drizzle-membership-repository";
import { CreateUser } from "@/modules/users/application/use-cases/create-user";
import { DrizzleUserRepository } from "@/modules/users/infrastructure/repositories/drizzle-user-repository";
import type { Database } from "./database/client";
import { scryptPasswordHasher } from "./security/scrypt-password-hasher";

export interface OrbisModules {
  createUser: CreateUser;
  createCompany: CreateCompany;
  getCompany: GetCompany;
  listCompanies: ListCompanies;
  updateCompany: UpdateCompany;
  createMembership: CreateMembership;
  listMemberships: ListMemberships;
}

export function buildModules(database: Database): OrbisModules {
  const userRepository = new DrizzleUserRepository(database);
  const companyRepository = new DrizzleCompanyRepository(database);
  const membershipRepository = new DrizzleMembershipRepository(database);

  const accessService = new MembershipAccessService(membershipRepository);

  return {
    createUser: new CreateUser(userRepository, scryptPasswordHasher),
    createCompany: new CreateCompany(companyRepository, membershipRepository),
    getCompany: new GetCompany(companyRepository, accessService),
    listCompanies: new ListCompanies(companyRepository),
    updateCompany: new UpdateCompany(companyRepository, accessService),
    createMembership: new CreateMembership(membershipRepository, companyRepository, userRepository),
    listMemberships: new ListMemberships(membershipRepository),
  };
}
