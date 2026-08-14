import { Entity } from "@/shared/domain/entity";

export interface CompanyProps {
  id: string;
  name: string;
  timezone: string;
  settings: Record<string, unknown>;
  dailyHoursPerDeveloper: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCompanyData {
  name: string;
  timezone?: string;
  settings?: Record<string, unknown>;
}

export class Company extends Entity<string> {
  private constructor(private readonly props: CompanyProps) {
    super(props.id);
  }

  static create(data: CreateCompanyData, id = crypto.randomUUID()): Company {
    const now = new Date();
    return new Company({
      id,
      name: data.name,
      timezone: data.timezone ?? "America/Sao_Paulo",
      settings: data.settings ?? {},
      dailyHoursPerDeveloper: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: CompanyProps): Company {
    return new Company(props);
  }

  get name(): string {
    return this.props.name;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get settings(): Record<string, unknown> {
    return this.props.settings;
  }

  get dailyHoursPerDeveloper(): number | null {
    return this.props.dailyHoursPerDeveloper;
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

  changeTimezone(timezone: string): void {
    this.props.timezone = timezone;
    this.touch();
  }

  changeSettings(settings: Record<string, unknown>): void {
    this.props.settings = settings;
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
