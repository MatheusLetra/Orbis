import type { SystemVersion } from "@/modules/versions/domain/entities/system-version";

export interface SystemVersionRepository {
  create(version: SystemVersion): Promise<SystemVersion>;
  findById(id: string): Promise<SystemVersion | null>;
  findVersionInSystem(systemId: string, version: string): Promise<SystemVersion | null>;
  listBySystem(systemId: string): Promise<SystemVersion[]>;
  update(version: SystemVersion): Promise<SystemVersion>;
  delete(id: string): Promise<void>;
}
