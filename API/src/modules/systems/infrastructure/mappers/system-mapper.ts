import { System } from "@/modules/systems/domain/entities/system";

export type SystemRow = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toEntity(row: SystemRow): System {
  return System.restore({
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toInsertValues(system: System): SystemRow {
  return {
    id: system.id,
    companyId: system.companyId,
    name: system.name,
    description: system.description,
    isActive: system.isActive,
    createdAt: system.createdAt,
    updatedAt: system.updatedAt,
  };
}
