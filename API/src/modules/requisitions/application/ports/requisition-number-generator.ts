export interface RequisitionNumberGenerator {
  next(companyId: string): Promise<number>;
}
