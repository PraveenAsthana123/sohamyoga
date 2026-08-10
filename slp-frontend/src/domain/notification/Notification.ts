export type NotificationChannel = "whatsapp" | "email" | "push" | "sms" | "in_app";
export type NotificationType =
  | "booking_confirmation"
  | "booking_reminder"        // 1h before class
  | "booking_cancellation"
  | "waitlist_promoted"
  | "subscription_started"
  | "subscription_renewal"
  | "subscription_expiring"   // 3 days before
  | "subscription_cancelled"
  | "payment_failed"
  | "class_cancelled"         // teacher cancels
  | "new_class_available"
  | "challenge_completed"
  | "streak_milestone"
  | "pose_score_improved"
  | "broadcast_teacher"       // teacher → all enrolled students
  | "broadcast_admin"         // admin → all users / segment
  | "alert_capacity_low"      // admin: class almost full
  | "alert_payment_overdue"
  | "self_service_password_reset"
  | "self_service_email_change"
  | "self_service_plan_change";

export type NotificationStatus = "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "SKIPPED";

export interface NotificationProps {
  id: string;
  userId: string;
  channel: NotificationChannel;
  type: NotificationType;
  subject?: string;
  body: string;
  metadata: Record<string, unknown>;
  status: NotificationStatus;
  scheduledAt: Date;
  sentAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
}

export class Notification {
  constructor(private props: NotificationProps) {
    if (!props.body.trim()) throw new Error("Notification body is required");
    if (props.maxRetries < 0) throw new Error("maxRetries cannot be negative");
  }

  get id()            { return this.props.id; }
  get userId()        { return this.props.userId; }
  get channel()       { return this.props.channel; }
  get type()          { return this.props.type; }
  get subject()       { return this.props.subject; }
  get body()          { return this.props.body; }
  get metadata()      { return { ...this.props.metadata }; }
  get status()        { return this.props.status; }
  get scheduledAt()   { return this.props.scheduledAt; }
  get retryCount()    { return this.props.retryCount; }

  isDue(): boolean { return this.props.scheduledAt <= new Date() && this.props.status === "PENDING"; }
  canRetry(): boolean { return this.props.retryCount < this.props.maxRetries && this.props.status === "FAILED"; }

  markSent(): Notification {
    return new Notification({ ...this.props, status: "SENT", sentAt: new Date() });
  }

  markDelivered(): Notification {
    return new Notification({ ...this.props, status: "DELIVERED" });
  }

  markFailed(reason: string): Notification {
    return new Notification({
      ...this.props,
      status: this.props.retryCount + 1 >= this.props.maxRetries ? "FAILED" : "PENDING",
      failureReason: reason,
      retryCount: this.props.retryCount + 1,
    });
  }

  skip(reason: string): Notification {
    return new Notification({ ...this.props, status: "SKIPPED", failureReason: reason });
  }

  toJSON(): NotificationProps { return { ...this.props, metadata: { ...this.props.metadata } }; }
}

// Broadcast: one admin/teacher sends to many users — generates N Notification instances
export interface BroadcastProps {
  id: string;
  senderId: string;
  senderRole: "teacher" | "admin";
  channels: NotificationChannel[];
  subject?: string;
  body: string;
  targetSegment: "all" | "students" | "teachers" | "enrolled_in_class";
  targetClassId?: string;     // used when targetSegment = "enrolled_in_class"
  scheduledAt: Date;
  createdAt: Date;
}

export class Broadcast {
  constructor(private readonly props: BroadcastProps) {
    if (!props.body.trim()) throw new Error("Broadcast body is required");
    if (props.targetSegment === "enrolled_in_class" && !props.targetClassId)
      throw new Error("targetClassId required for enrolled_in_class broadcasts");
    if (props.channels.length === 0)
      throw new Error("At least one channel required");
  }

  get id()             { return this.props.id; }
  get senderId()       { return this.props.senderId; }
  get senderRole()     { return this.props.senderRole; }
  get channels()       { return [...this.props.channels]; }
  get subject()        { return this.props.subject; }
  get body()           { return this.props.body; }
  get targetSegment()  { return this.props.targetSegment; }
  get targetClassId()  { return this.props.targetClassId; }
  get scheduledAt()    { return this.props.scheduledAt; }

  toJSON(): BroadcastProps { return { ...this.props, channels: [...this.props.channels] }; }
}

// Alert: system-generated, sent to admins or relevant users
export interface AlertProps {
  id: string;
  type: "capacity_low" | "payment_overdue" | "class_cancelled" | "system_error" | "new_signup";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  targetUserIds: string[];   // empty = all admins
  metadata: Record<string, unknown>;
  acknowledged: boolean;
  createdAt: Date;
}

export class Alert {
  constructor(private props: AlertProps) {}

  get id()           { return this.props.id; }
  get type()         { return this.props.type; }
  get severity()     { return this.props.severity; }
  get title()        { return this.props.title; }
  get message()      { return this.props.message; }
  get acknowledged() { return this.props.acknowledged; }

  acknowledge(): Alert {
    return new Alert({ ...this.props, acknowledged: true });
  }

  isCritical(): boolean { return this.props.severity === "critical"; }

  toJSON(): AlertProps { return { ...this.props, targetUserIds: [...this.props.targetUserIds] }; }
}
