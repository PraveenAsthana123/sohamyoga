export type NotificationRecipientKind = 'admin' | 'business_customer';

export interface NotificationProps {
  id: string;
  recipientKind: NotificationRecipientKind;
  recipientId: string | null;
  type: string;
  title: string;
  body: string;
  relatedCallId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export class Notification {
  private readonly props: NotificationProps;

  constructor(props: NotificationProps) {
    if (props.recipientKind === 'business_customer' && !props.recipientId) {
      throw new Error('business_customer notifications require a recipientId');
    }
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get readAt() { return this.props.readAt; }

  markRead(): Notification {
    return new Notification({ ...this.props, readAt: new Date() });
  }

  toJSON(): NotificationProps {
    return { ...this.props };
  }
}
