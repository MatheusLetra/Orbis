import type { Release } from "@/modules/releases/domain/entities/release";

export interface ReleaseRepository {
  create(release: Release): Promise<Release>;
  findById(id: string): Promise<Release | null>;
  listByCompany(companyId: string): Promise<Release[]>;
  update(release: Release): Promise<Release>;
  delete(id: string): Promise<void>;
}
