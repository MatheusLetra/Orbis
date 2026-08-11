import { Entity } from "../../../../shared/domain/entity.js";
import { Position } from "../value-objects/position.js";

export interface MembershipProps {
  id: string;
  companyId: string;
  userId: string;
  position: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMembershipData {
  companyId: string;
  userId: string;
  position: string;
}

export class Membership extends Entity<string> {
  private constructor(private readonly props: MembershipProps) {
    super(props.id);
  }

  static create(data: CreateMembershipData, id = crypto.randomUUID()): Membership {
    const position = new Position(data.position);
    const now = new Date();

    return new Membership({
      id,
      companyId: data.companyId,
      userId: data.userId,
      position: position.get(),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: MembershipProps): Membership {
    return new Membership(props);
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get position(): string {
    return this.props.position;
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

  changePosition(position: string): void {
    this.props.position = new Position(position).get();
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
