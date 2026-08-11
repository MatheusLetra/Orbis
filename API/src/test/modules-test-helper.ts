import type { OrbisModules } from "@/infrastructure/composition-root";
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
  InMemoryUserRepository,
} from "./fakes/identity-fakes";

export interface TestModules extends OrbisModules {
  repositories: {
    users: InMemoryUserRepository;
    companies: InMemoryCompanyRepository;
    memberships: InMemoryMembershipRepository;
  };
}

export function buildTestModules(): TestModules {
  const users = new InMemoryUserRepository();
  const companies = new InMemoryCompanyRepository();
  const memberships = new InMemoryMembershipRepository();
  const accessService = new MembershipAccessService(memberships);

  return {
    repositories: { users, companies, memberships },
    createUser: new CreateUser(users, fakePasswordHasher),
    createCompany: new CreateCompany(companies, memberships),
    getCompany: new GetCompany(companies, accessService),
    listCompanies: new ListCompanies(companies),
    updateCompany: new UpdateCompany(companies, accessService),
    createMembership: new CreateMembership(memberships, companies, users),
    listMemberships: new ListMemberships(memberships),
  };
}
