import type { NotificationEventType } from "@/modules/notifications/domain/notification-event";
import { Entity } from "@/shared/domain/entity";

export interface NotificationProps {
  id: string;
  companyId: string;
  userId: string;
  eventId: string | null;
  type: NotificationEventType;
  title: string;
  body: string | null;
  readAt: Date | null;
  data: Record<string, unknown> | null;
  createdAt: Date;
}

export class Notification extends Entity<string> {
  private constructor(private readonly props: NotificationProps) {
    super(props.id);
  }

  static create(
    data: Omit<NotificationProps, "id" | "readAt" | "createdAt">,
    id = crypto.randomUUID(),
  ): Notification {
    return new Notification({ ...data, id, readAt: null, createdAt: new Date() });
  }

  static restore(props: NotificationProps): Notification {
    return new Notification(props);
  }

  get companyId() {
    return this.props.companyId;
  }
  get userId() {
    return this.props.userId;
  }
  get eventId() {
    return this.props.eventId;
  }
  get type() {
    return this.props.type;
  }
  get title() {
    return this.props.title;
  }
  get body() {
    return this.props.body;
  }
  get readAt() {
    return this.props.readAt;
  }
  get data() {
    return this.props.data;
  }
  get createdAt() {
    return this.props.createdAt;
  }

  markRead(at = new Date()): void {
    if (this.props.readAt === null) this.props.readAt = at;
  }
}
