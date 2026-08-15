export interface CompanyMemberLookup {
  userId: string;
  name: string;
}

export interface CompanyMemberLookupRepository {
  listActiveByCompany(companyId: string, search?: string): Promise<CompanyMemberLookup[]>;
  listMembershipsByCompany(companyId: string): Promise<CompanyMembershipLookup[]>;
}

export interface CompanyMembershipLookup {
  id: string;
  companyId: string;
  userId: string;
  name: string;
  email: string;
  position: string;
  permissions: string[];
  isActive: boolean;
  userIsActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
