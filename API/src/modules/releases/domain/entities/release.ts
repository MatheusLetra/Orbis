import { Entity } from "@/shared/domain/entity";

export const RELEASE_CHANNELS = ["STABLE", "BETA"] as const;
export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

export const RELEASE_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export interface ReleaseProps {
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
}

export interface CreateReleaseData {
  companyId: string;
  systemVersionId: string;
  versionLabel: string;
  channel?: ReleaseChannel;
  createdBy: string;
}

export interface ReleaseArtifactData {
  artifactName: string;
  artifactLocation: string;
}

export interface ReleaseMetadataData {
  versionLabel?: string;
  channel?: ReleaseChannel;
}

export class Release extends Entity<string> {
  private constructor(private readonly props: ReleaseProps) {
    super(props.id);
  }

  static create(data: CreateReleaseData, id = crypto.randomUUID()): Release {
    const now = new Date();

    return new Release({
      id,
      companyId: data.companyId,
      systemVersionId: data.systemVersionId,
      versionLabel: data.versionLabel,
      channel: data.channel ?? "STABLE",
      status: "DRAFT",
      artifactName: null,
      artifactLocation: null,
      publishedAt: null,
      createdBy: data.createdBy,
      createdAt: now,
    });
  }

  static restore(props: ReleaseProps): Release {
    return new Release(props);
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get systemVersionId(): string {
    return this.props.systemVersionId;
  }

  get versionLabel(): string {
    return this.props.versionLabel;
  }

  get channel(): ReleaseChannel {
    return this.props.channel;
  }

  get status(): ReleaseStatus {
    return this.props.status;
  }

  get artifactName(): string | null {
    return this.props.artifactName;
  }

  get artifactLocation(): string | null {
    return this.props.artifactLocation;
  }

  get publishedAt(): Date | null {
    return this.props.publishedAt;
  }

  get createdBy(): string {
    return this.props.createdBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  publish(artifact: ReleaseArtifactData): void {
    if (this.status !== "DRAFT") {
      throw new Error("Apenas releases em rascunho podem ser publicadas");
    }
    const location = artifact.artifactLocation.trim();
    if (!location || location.length > 2048) {
      throw new Error("Localização do artefato inválida");
    }
    this.props.artifactName = artifact.artifactName;
    this.props.artifactLocation = location;
    this.props.status = "PUBLISHED";
    this.props.publishedAt = new Date();
  }

  updateMetadata(metadata: ReleaseMetadataData): void {
    if (this.status !== "DRAFT") {
      throw new Error("Apenas releases em rascunho podem ser alteradas");
    }
    if (metadata.versionLabel !== undefined) this.props.versionLabel = metadata.versionLabel;
    if (metadata.channel !== undefined) this.props.channel = metadata.channel;
  }
}
