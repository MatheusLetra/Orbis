import type { NotificationEventType } from "@/modules/notifications/domain/notification-event";
import { Entity } from "@/shared/domain/entity";

export interface NotificationPreferenceProps {
  id: string;
  userId: string;
  companyId: string;
  eventType: NotificationEventType;
  inAppEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationPreference extends Entity<string> {
  private constructor(private readonly props: NotificationPreferenceProps) {
    super(props.id);
  }

  static create(
    data: Pick<NotificationPreferenceProps, "userId" | "companyId" | "eventType" | "inAppEnabled">,
  ): NotificationPreference {
    const now = new Date();
    return new NotificationPreference({
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: NotificationPreferenceProps): NotificationPreference {
    return new NotificationPreference(props);
  }
  get userId() {
    return this.props.userId;
  }
  get companyId() {
    return this.props.companyId;
  }
  get eventType() {
    return this.props.eventType;
  }
  get inAppEnabled() {
    return this.props.inAppEnabled;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
  setInAppEnabled(enabled: boolean): void {
    this.props.inAppEnabled = enabled;
    this.props.updatedAt = new Date();
  }
}
