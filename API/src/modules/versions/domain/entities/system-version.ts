import { Entity } from "@/shared/domain/entity";

export interface SystemVersionProps {
  id: string;
  companyId: string;
  systemId: string;
  version: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSystemVersionData {
  companyId: string;
  systemId: string;
  version: string;
}

export class SystemVersion extends Entity<string> {
  private constructor(private readonly props: SystemVersionProps) {
    super(props.id);
  }

  static create(data: CreateSystemVersionData, id = crypto.randomUUID()): SystemVersion {
    const now = new Date();

    return new SystemVersion({
      id,
      companyId: data.companyId,
      systemId: data.systemId,
      version: data.version,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: SystemVersionProps): SystemVersion {
    return new SystemVersion(props);
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get systemId(): string {
    return this.props.systemId;
  }

  get version(): string {
    return this.props.version;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  changeVersion(version: string): void {
    this.props.version = version;
    this.touch();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.touch();
  }

  reactivate(): void {
    this.props.isActive = true;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}
