import type { System } from "@/modules/systems/domain/entities/system";

export interface SystemRepository {
  create(system: System): Promise<System>;
  findById(id: string): Promise<System | null>;
  findByNameInCompany(companyId: string, name: string): Promise<System | null>;
  listByCompany(companyId: string): Promise<System[]>;
  update(system: System): Promise<System>;
  delete(id: string): Promise<void>;
}
