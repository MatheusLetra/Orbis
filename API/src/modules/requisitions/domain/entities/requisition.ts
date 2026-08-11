import { Entity } from "@/shared/domain/entity";

export const REQUISITION_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type RequisitionPriority = (typeof REQUISITION_PRIORITIES)[number];

export const REQUISITION_STATUSES = ["OPEN", "IN_PROGRESS", "PAUSED", "DONE", "CANCELLED"] as const;
export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number];

export interface RequisitionProps {
  id: string;
  companyId: string;
  number: number;
  title: string;
  description: string | null;
  priority: RequisitionPriority;
  status: RequisitionStatus;
  requesterId: string;
  responsibleId: string | null;
  systemId: string | null;
  systemVersionId: string | null;
  estimatedHours: number | null;
  startDate: Date | null;
  plannedDeliveryDate: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRequisitionData {
  companyId: string;
  number: number;
  title: string;
  description?: string;
  priority?: RequisitionPriority;
  requesterId: string;
  responsibleId?: string;
  systemId?: string;
  systemVersionId?: string;
  estimatedHours?: number;
  startDate?: Date;
  plannedDeliveryDate?: Date;
  deliveredAt?: Date;
}

export class Requisition extends Entity<string> {
  private constructor(private readonly props: RequisitionProps) {
    super(props.id);
  }

  static create(data: CreateRequisitionData, id = crypto.randomUUID()): Requisition {
    const now = new Date();

    return new Requisition({
      id,
      companyId: data.companyId,
      number: data.number,
      title: data.title,
      description: data.description?.trim() || null,
      priority: data.priority ?? "MEDIUM",
      status: "OPEN",
      requesterId: data.requesterId,
      responsibleId: data.responsibleId ?? null,
      systemId: data.systemId ?? null,
      systemVersionId: data.systemVersionId ?? null,
      estimatedHours: data.estimatedHours ?? null,
      startDate: data.startDate ?? null,
      plannedDeliveryDate: data.plannedDeliveryDate ?? null,
      deliveredAt: data.deliveredAt ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: RequisitionProps): Requisition {
    return new Requisition(props);
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get number(): number {
    return this.props.number;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string | null {
    return this.props.description;
  }

  get priority(): RequisitionPriority {
    return this.props.priority;
  }

  get status(): RequisitionStatus {
    return this.props.status;
  }

  get requesterId(): string {
    return this.props.requesterId;
  }

  get responsibleId(): string | null {
    return this.props.responsibleId;
  }

  get systemId(): string | null {
    return this.props.systemId;
  }

  get systemVersionId(): string | null {
    return this.props.systemVersionId;
  }

  get estimatedHours(): number | null {
    return this.props.estimatedHours;
  }

  get startDate(): Date | null {
    return this.props.startDate;
  }

  get plannedDeliveryDate(): Date | null {
    return this.props.plannedDeliveryDate;
  }

  get deliveredAt(): Date | null {
    return this.props.deliveredAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  rename(title: string): void {
    this.props.title = title;
    this.touch();
  }

  changeDescription(description: string | null): void {
    this.props.description = description?.trim() || null;
    this.touch();
  }

  changePriority(priority: RequisitionPriority): void {
    this.props.priority = priority;
    this.touch();
  }

  changeResponsible(responsibleId: string | null): void {
    this.props.responsibleId = responsibleId;
    this.touch();
  }

  changeSystem(systemId: string | null): void {
    this.props.systemId = systemId;
    this.touch();
  }

  changeSystemVersion(systemVersionId: string | null): void {
    this.props.systemVersionId = systemVersionId;
    this.touch();
  }

  changeEstimatedHours(estimatedHours: number | null): void {
    this.props.estimatedHours = estimatedHours;
    this.touch();
  }

  changeStartDate(startDate: Date | null): void {
    this.props.startDate = startDate;
    this.touch();
  }

  changePlannedDeliveryDate(plannedDeliveryDate: Date | null): void {
    this.props.plannedDeliveryDate = plannedDeliveryDate;
    this.touch();
  }

  changeDeliveredAt(deliveredAt: Date | null): void {
    this.props.deliveredAt = deliveredAt;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}
