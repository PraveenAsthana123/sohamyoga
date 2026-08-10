// NotificationTemplate — versioned, multi-channel message template.
// Lifecycle: draft → approved → active → archived.
// Supports email, SMS, WhatsApp, push, in-app, Telegram, Discord, Slack.
// All data stored locally — never synced to external services.

export type NotificationChannel =
  | 'email' | 'sms' | 'whatsapp' | 'push' | 'in_app'
  | 'telegram' | 'discord' | 'slack' | 'voice';

export type NotificationType =
  | 'transactional' | 'marketing' | 'reminder' | 'alert' | 'otp';

export type NotificationTemplateStatus =
  | 'draft' | 'approved' | 'active' | 'archived';

export interface NotificationTemplateProps {
  id:          string;
  tenantId:    string;
  slug:        string;         // unique key e.g. 'booking_reminder_email'
  name:        string;
  channel:     NotificationChannel;
  type:        NotificationType;
  subject?:    string;         // required for email channel
  body:        string;         // mustache-style template: {{variable}}
  variables:   string[];       // required variable names in the template
  locale:      string;         // 'en', 'fr', 'hi', ...
  status:      NotificationTemplateStatus;
  version:     number;
  approvedBy?: string;
  approvedAt?: Date;
  createdBy:   string;
  createdAt:   Date;
  updatedAt:   Date;
}

export class NotificationTemplate {
  private readonly props: Readonly<NotificationTemplateProps>;

  constructor(props: NotificationTemplateProps) {
    if (!props.id)                            throw new Error('id is required');
    if (!props.tenantId)                      throw new Error('tenantId is required');
    if (!props.slug.match(/^[a-z][a-z0-9_]+$/)) throw new Error("slug must be snake_case");
    if (!props.name.trim())                   throw new Error('name is required');
    if (!props.body.trim())                   throw new Error('body is required');
    if (props.channel === 'email' && !props.subject?.trim())
      throw new Error('subject is required for email channel');
    if (props.version < 1)                    throw new Error('version must be >= 1');
    if (props.status === 'approved' && !props.approvedBy)
      throw new Error('approvedBy required when status is approved');
    if (props.status === 'active' && !props.approvedBy)
      throw new Error('approvedBy required when status is active');
    this.props = Object.freeze({ ...props, variables: [...props.variables] });
  }

  private clone(patch: Partial<NotificationTemplateProps>): NotificationTemplate {
    return new NotificationTemplate({ ...this.props, ...patch });
  }

  get id()          { return this.props.id; }
  get tenantId()    { return this.props.tenantId; }
  get slug()        { return this.props.slug; }
  get name()        { return this.props.name; }
  get channel()     { return this.props.channel; }
  get type()        { return this.props.type; }
  get subject()     { return this.props.subject; }
  get body()        { return this.props.body; }
  get variables()   { return [...this.props.variables]; }
  get locale()      { return this.props.locale; }
  get status()      { return this.props.status; }
  get version()     { return this.props.version; }
  get approvedBy()  { return this.props.approvedBy; }
  get approvedAt()  { return this.props.approvedAt; }
  get createdBy()   { return this.props.createdBy; }
  get updatedAt()   { return this.props.updatedAt; }

  isDraft():    boolean { return this.props.status === 'draft'; }
  isActive():   boolean { return this.props.status === 'active'; }
  isArchived(): boolean { return this.props.status === 'archived'; }

  /** Staff review complete — draft → approved */
  approve(approvedBy: string, at: Date): NotificationTemplate {
    if (this.props.status !== 'draft')
      throw new Error(`Can only approve draft templates, current status: ${this.props.status}`);
    return this.clone({ status: 'approved', approvedBy, approvedAt: at, updatedAt: at });
  }

  /** Make live for sending — approved → active */
  activate(at: Date): NotificationTemplate {
    if (this.props.status !== 'approved')
      throw new Error(`Can only activate approved templates, current status: ${this.props.status}`);
    return this.clone({ status: 'active', updatedAt: at });
  }

  /** Retire without deletion — any non-archived state → archived */
  archive(at: Date): NotificationTemplate {
    if (this.props.status === 'archived')
      throw new Error('Template is already archived');
    return this.clone({ status: 'archived', updatedAt: at });
  }

  /** Edit content — always resets to draft with incremented version */
  updateContent(
    body: string,
    subject: string | undefined,
    updatedBy: string,
    at: Date,
  ): NotificationTemplate {
    if (!body.trim()) throw new Error('body cannot be empty');
    if (this.props.channel === 'email' && !subject?.trim())
      throw new Error('subject is required for email channel');
    if (this.props.status === 'archived')
      throw new Error('Cannot edit an archived template');
    return this.clone({
      body,
      subject,
      version:    this.props.version + 1,
      status:     'draft',
      approvedBy: undefined,
      approvedAt: undefined,
      createdBy:  updatedBy,
      updatedAt:  at,
    });
  }
}

// ── Seed template slugs ───────────────────────────────────────────────────────

export const TEMPLATE_SLUGS = [
  'registration_welcome_email',
  'otp_verification_sms',
  'otp_verification_email',
  'membership_activated_email',
  'booking_confirmation_email',
  'booking_confirmation_sms',
  'booking_cancellation_email',
  'booking_reminder_email',
  'booking_reminder_sms',
  'payment_receipt_email',
  'refund_processed_email',
  'coupon_issued_email',
  'referral_reward_email',
  'birthday_wishes_email',
  'anniversary_wishes_email',
  'workshop_invitation_email',
  'retreat_invitation_email',
  'survey_invitation_email',
  'newsletter_weekly_email',
  'blog_new_post_email',
  'promotional_offer_email',
  'promotional_offer_sms',
  'membership_expiry_reminder_email',
  'class_cancellation_alert_email',
  'teacher_changed_alert_email',
] as const;

export type TemplateSlug = typeof TEMPLATE_SLUGS[number];
