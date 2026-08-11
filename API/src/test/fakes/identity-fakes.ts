import type { Company } from "../../modules/companies/domain/entities/company.js";
import type { CompanyRepository } from "../../modules/companies/domain/repositories/company-repository.js";
import type { Membership } from "../../modules/memberships/domain/entities/membership.js";
import type { MembershipRepository } from "../../modules/memberships/domain/repositories/membership-repository.js";
import type { PasswordHasher } from "../../modules/users/application/ports/password-hasher.js";
import type { User } from "../../modules/users/domain/entities/user.js";
import type { UserRepository } from "../../modules/users/domain/repositories/user-repository.js";

export class InMemoryCompanyRepository implements CompanyRepository {
  private readonly items = new Map<string, Company>();
  private readonly userLinks = new Map<string, Map<string, boolean>>();

  linkUser(userId: string, companyId: string, active = true): void {
    const links = this.userLinks.get(userId) ?? new Map();
    links.set(companyId, active);
    this.userLinks.set(userId, links);
  }

  async create(company: Company): Promise<Company> {
    this.items.set(company.id, company);
    return company;
  }

  async findById(id: string): Promise<Company | null> {
    return this.items.get(id) ?? null;
  }

  async findByUser(userId: string): Promise<Company[]> {
    const links = this.userLinks.get(userId) ?? new Map();
    return [...links.entries()]
      .filter(([, active]) => active)
      .map(([companyId]) => this.items.get(companyId))
      .filter((company): company is Company => company !== undefined);
  }

  async update(company: Company): Promise<Company> {
    this.items.set(company.id, company);
    return company;
  }
}

export class InMemoryUserRepository implements UserRepository {
  private readonly items = new Map<string, User>();

  async create(user: User): Promise<User> {
    this.items.set(user.id, user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.items.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.items.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async update(user: User): Promise<User> {
    this.items.set(user.id, user);
    return user;
  }
}

export class InMemoryMembershipRepository implements MembershipRepository {
  private readonly items = new Map<string, Membership>();

  async create(membership: Membership): Promise<Membership> {
    this.items.set(membership.id, membership);
    return membership;
  }

  async findById(id: string): Promise<Membership | null> {
    return this.items.get(id) ?? null;
  }

  async findByUserAndCompany(userId: string, companyId: string): Promise<Membership | null> {
    for (const membership of this.items.values()) {
      if (membership.userId === userId && membership.companyId === companyId) {
        return membership;
      }
    }
    return null;
  }

  async listByUser(userId: string): Promise<Membership[]> {
    return [...this.items.values()]
      .filter((membership) => membership.userId === userId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async listByCompany(companyId: string): Promise<Membership[]> {
    return [...this.items.values()]
      .filter((membership) => membership.companyId === companyId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async update(membership: Membership): Promise<Membership> {
    this.items.set(membership.id, membership);
    return membership;
  }
}

export const fakePasswordHasher: PasswordHasher = {
  hash: async (password: string) => `scrypt:${password}`,
  verify: async (password: string, storedHash: string) => storedHash === `scrypt:${password}`,
};
