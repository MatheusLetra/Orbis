import {
  Release,
  type ReleaseChannel,
  type ReleaseStatus,
} from "@/modules/releases/domain/entities/release";

export type ReleaseRow = {
  id: string;
  companyId: string;
  systemVersionId: string;
  versionLabel: string;
  channel: ReleaseChannel;
  status: ReleaseStatus;
  artifactName: string | null;
  artifactLocation: string | null;
  publishedAt: Date | null;
  createdBy: string;
  createdAt: Date;
};

export function toEntity(row: ReleaseRow): Release {
  return Release.restore({
    id: row.id,
    companyId: row.companyId,
    systemVersionId: row.systemVersionId,
    versionLabel: row.versionLabel,
    channel: row.channel,
    status: row.status,
    artifactName: row.artifactName,
    artifactLocation: row.artifactLocation,
    publishedAt: row.publishedAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  });
}

export function toInsertValues(release: Release): ReleaseRow {
  return {
    id: release.id,
    companyId: release.companyId,
    systemVersionId: release.systemVersionId,
    versionLabel: release.versionLabel,
    channel: release.channel,
    status: release.status,
    artifactName: release.artifactName,
    artifactLocation: release.artifactLocation,
    publishedAt: release.publishedAt,
    createdBy: release.createdBy,
    createdAt: release.createdAt,
  };
}
