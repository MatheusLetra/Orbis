import { Entity } from "@/shared/domain/entity";

export interface SystemProps {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSystemData {
  companyId: string;
  name: string;
  description?: string;
}

export class System extends Entity<string> {
  private constructor(private readonly props: SystemProps) {
    super(props.id);
  }

  static create(data: CreateSystemData, id = crypto.randomUUID()): System {
    const now = new Date();

    return new System({
      id,
      companyId: data.companyId,
      name: data.name,
      description: data.description?.trim() || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: SystemProps): System {
    return new System(props);
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
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

  rename(name: string): void {
    this.props.name = name;
    this.touch();
  }

  changeDescription(description: string | null): void {
    this.props.description = description?.trim() || null;
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
