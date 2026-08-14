import { Entity } from "@/shared/domain/entity";

export interface ConversationMemberProps {
  id: string;
  conversationId: string;
  userId: string;
  lastReadAt: Date | null;
  createdAt: Date;
}

export class ConversationMember extends Entity<string> {
  private constructor(private readonly props: ConversationMemberProps) {
    super(props.id);
  }

  static create(conversationId: string, userId: string, at = new Date(), id = crypto.randomUUID()) {
    return new ConversationMember({ id, conversationId, userId, lastReadAt: null, createdAt: at });
  }

  static restore(props: ConversationMemberProps) {
    return new ConversationMember(props);
  }

  get conversationId() {
    return this.props.conversationId;
  }
  get userId() {
    return this.props.userId;
  }
  get lastReadAt() {
    return this.props.lastReadAt;
  }
  get createdAt() {
    return this.props.createdAt;
  }

  markRead(at: Date): void {
    this.props.lastReadAt = at;
  }
}
