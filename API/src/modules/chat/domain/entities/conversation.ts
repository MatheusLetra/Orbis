import type { ConversationType } from "@/modules/chat/domain/conversation-type";
import { Entity } from "@/shared/domain/entity";

export interface ConversationProps {
  id: string;
  companyId: string;
  type: ConversationType;
  directKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Conversation extends Entity<string> {
  private constructor(private readonly props: ConversationProps) {
    super(props.id);
  }

  static create(companyId: string, userIds: readonly [string, string], id = crypto.randomUUID()) {
    const now = new Date();
    return new Conversation({
      id,
      companyId,
      type: "direct",
      directKey: canonicalDirectKey(userIds),
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: ConversationProps) {
    return new Conversation(props);
  }

  get companyId() {
    return this.props.companyId;
  }
  get type() {
    return this.props.type;
  }
  get directKey() {
    return this.props.directKey;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  touch(at: Date): void {
    this.props.updatedAt = at;
  }
}

export function canonicalDirectKey(userIds: readonly [string, string]): string {
  return [...userIds].sort((a, b) => a.localeCompare(b)).join(":");
}
