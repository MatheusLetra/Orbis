import { SystemVersion } from "@/modules/versions/domain/entities/system-version";

export type SystemVersionRow = {
  id: string;
  companyId: string;
  systemId: string;
  version: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toEntity(row: SystemVersionRow): SystemVersion {
  return SystemVersion.restore({
    id: row.id,
    companyId: row.companyId,
    systemId: row.systemId,
    version: row.version,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toInsertValues(version: SystemVersion): SystemVersionRow {
  return {
    id: version.id,
    companyId: version.companyId,
    systemId: version.systemId,
    version: version.version,
    isActive: version.isActive,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  };
}
