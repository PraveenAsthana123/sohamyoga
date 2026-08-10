// NotificationPreference — per-user channel and type opt-in controls.
// Quiet hours and language stored locally — never shared with external services.

import type { NotificationChannel } from './NotificationTemplate';

export type NotificationTypePreference = 'transactional' | 'marketing' | 'reminder' | 'alert' | 'otp';

export interface NotificationPreferenceProps {
  id:                  string;
  tenantId:            string;
  userId:              string;
  // Channel opt-in flags
  emailEnabled:        boolean;
  smsEnabled:          boolean;
  pushEnabled:         boolean;
  whatsappEnabled:     boolean;
  inAppEnabled:        boolean;
  telegramEnabled:     boolean;
  // Type opt-in flags
  marketingEnabled:    boolean;
  transactionalEnabled:boolean;  // OTP/booking/payment — usually always true
  reminderEnabled:     boolean;
  alertEnabled:        boolean;
  // Locale
  language:            string;   // 'en', 'fr', 'hi', ...
  // Quiet hours (HH:MM strings, e.g. "22:00", "08:00")
  quietHoursStart?:    string;
  quietHoursEnd?:      string;
  timezone:            string;
  updatedAt:           Date;
}

export class NotificationPreference {
  private readonly props: Readonly<NotificationPreferenceProps>;

  constructor(props: NotificationPreferenceProps) {
    if (!props.id)       throw new Error('id is required');
    if (!props.tenantId) throw new Error('tenantId is required');
    if (!props.userId)   throw new Error('userId is required');
    if (!props.timezone) throw new Error('timezone is required');
    if (props.quietHoursStart && !props.quietHoursStart.match(/^\d{2}:\d{2}$/))
      throw new Error("quietHoursStart must be HH:MM format");
    if (props.quietHoursEnd && !props.quietHoursEnd.match(/^\d{2}:\d{2}$/))
      throw new Error("quietHoursEnd must be HH:MM format");
    if ((props.quietHoursStart && !props.quietHoursEnd) ||
        (!props.quietHoursStart && props.quietHoursEnd))
      throw new Error('Both quietHoursStart and quietHoursEnd must be set together');
    this.props = Object.freeze({ ...props });
  }

  private clone(patch: Partial<NotificationPreferenceProps>): NotificationPreference {
    return new NotificationPreference({ ...this.props, ...patch });
  }

  get id()         { return this.props.id; }
  get userId()     { return this.props.userId; }
  get language()   { return this.props.language; }
  get timezone()   { return this.props.timezone; }
  get updatedAt()  { return this.props.updatedAt; }

  isChannelEnabled(channel: NotificationChannel): boolean {
    switch (channel) {
      case 'email':    return this.props.emailEnabled;
      case 'sms':      return this.props.smsEnabled;
      case 'push':     return this.props.pushEnabled;
      case 'whatsapp': return this.props.whatsappEnabled;
      case 'in_app':   return this.props.inAppEnabled;
      case 'telegram': return this.props.telegramEnabled;
      default:         return false;   // discord/slack/voice — not user-configurable
    }
  }

  isTypeEnabled(type: NotificationTypePreference): boolean {
    switch (type) {
      case 'transactional': return this.props.transactionalEnabled;
      case 'marketing':     return this.props.marketingEnabled;
      case 'reminder':      return this.props.reminderEnabled;
      case 'alert':         return this.props.alertEnabled;
      case 'otp':           return this.props.transactionalEnabled; // OTP follows transactional
      default:              return false;
    }
  }

  /**
   * Returns true if currentHHMM falls within quiet hours.
   * Supports overnight windows (e.g. 22:00–08:00).
   * Pass in the current time in HH:MM format, already adjusted for the user's timezone.
   */
  isInQuietHours(currentHHMM: string): boolean {
    if (!this.props.quietHoursStart || !this.props.quietHoursEnd) return false;
    const toMinutes = (hhmm: string): number => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };
    const current = toMinutes(currentHHMM);
    const start   = toMinutes(this.props.quietHoursStart);
    const end     = toMinutes(this.props.quietHoursEnd);
    if (start <= end) {
      return current >= start && current <= end;  // same-day window
    } else {
      return current >= start || current <= end;  // overnight window
    }
  }

  /** Immutable update — returns new instance */
  update(patch: Partial<Omit<NotificationPreferenceProps, 'id' | 'tenantId' | 'userId'>>, at: Date): NotificationPreference {
    return this.clone({ ...patch, updatedAt: at });
  }

  /** Transactional notifications (OTP, booking, payment) should never be disabled */
  isTransactionalAlwaysOn(): boolean {
    return this.props.transactionalEnabled;
  }
}
