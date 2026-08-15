import type { Release, ReleaseMetadataData } from "@/modules/releases/domain/entities/release";

export interface ReleaseRepository {
  create(release: Release): Promise<Release>;
  findById(id: string): Promise<Release | null>;
  listByCompany(companyId: string): Promise<Release[]>;
  update(release: Release): Promise<Release>;
  updateMetadataIfDraft(
    id: string,
    companyId: string,
    metadata: ReleaseMetadataData,
  ): Promise<Release | null>;
  publishIfDraft(
    id: string,
    artifact: { artifactName: string; artifactLocation: string },
  ): Promise<Release | null>;
  delete(id: string): Promise<void>;
}
