import { Entity } from "@/shared/domain/entity";

export interface MessageProps {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: Date;
}

export class Message extends Entity<string> {
  private constructor(private readonly props: MessageProps) {
    super(props.id);
  }

  static create(
    conversationId: string,
    senderId: string,
    body: string,
    at = new Date(),
    id = crypto.randomUUID(),
  ) {
    return new Message({ id, conversationId, senderId, body, createdAt: at });
  }

  static restore(props: MessageProps) {
    return new Message(props);
  }

  get conversationId() {
    return this.props.conversationId;
  }
  get senderId() {
    return this.props.senderId;
  }
  get body() {
    return this.props.body;
  }
  get createdAt() {
    return this.props.createdAt;
  }
}
