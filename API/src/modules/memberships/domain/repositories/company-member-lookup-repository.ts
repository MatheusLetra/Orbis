export interface CompanyMemberLookup {
  userId: string;
  name: string;
}

export interface CompanyMemberLookupRepository {
  listActiveByCompany(companyId: string, search?: string): Promise<CompanyMemberLookup[]>;
}
