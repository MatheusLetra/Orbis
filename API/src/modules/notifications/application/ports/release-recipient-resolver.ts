export interface ReleaseRecipientResolver {
  resolve(companyId: string): Promise<string[]>;
}
