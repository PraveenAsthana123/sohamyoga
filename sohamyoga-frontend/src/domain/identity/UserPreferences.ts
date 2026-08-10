// User personalization, notification preferences, timezone, and celebration settings

export type NotificationPref = {
  channel: "email" | "whatsapp" | "push" | "in_app";
  enabled: boolean;
  types: string[];   // NotificationType[] keys
};

export type WishCardStyle = "simple" | "animated" | "photo" | "yoga_themed";

export interface UserPreferencesProps {
  userId: string;

  // Personalization
  timezone: string;               // IANA tz, e.g. "America/Vancouver"
  preferredStyles: string[];      // e.g. ["Hatha", "Yin"]
  preferredLevel: string;         // "Beginner" | "Intermediate" | "Advanced"
  preferredTeacherIds: string[];  // saved favourite teachers
  preferredClassTimes: string[];  // e.g. ["morning", "evening"]
  goalStatement: string;          // "I want to reduce stress and build flexibility"

  // Calendar & reminders
  calendarSyncEnabled: boolean;
  reminderMinutesBefore: number;  // 0 = off, 15, 30, 60

  // Notification channels
  notifications: NotificationPref[];

  // Birthday / Anniversary (for wish sending)
  birthday?: string;       // "MM-DD" format — no year for privacy
  memberSince: Date;       // anniversary date
  wishCardStyle: WishCardStyle;
  receiveWishes: boolean;  // opt-in to receiving birthday/anniversary wishes

  // Poll
  allowPolls: boolean;     // receives community polls

  // Links
  shareableProfileLink?: string;   // e.g. /profile/aisha-patel-123

  updatedAt: Date;
}

export class UserPreferences {
  constructor(private props: UserPreferencesProps) {
    if (props.reminderMinutesBefore < 0)
      throw new Error("Reminder minutes cannot be negative");
  }

  get userId()                    { return this.props.userId; }
  get timezone()                  { return this.props.timezone; }
  get preferredStyles()           { return [...this.props.preferredStyles]; }
  get preferredLevel()            { return this.props.preferredLevel; }
  get preferredTeacherIds()       { return [...this.props.preferredTeacherIds]; }
  get preferredClassTimes()       { return [...this.props.preferredClassTimes]; }
  get goalStatement()             { return this.props.goalStatement; }
  get calendarSyncEnabled()       { return this.props.calendarSyncEnabled; }
  get reminderMinutesBefore()     { return this.props.reminderMinutesBefore; }
  get notifications()             { return this.props.notifications.map(n => ({ ...n, types: [...n.types] })); }
  get birthday()                  { return this.props.birthday; }
  get memberSince()               { return this.props.memberSince; }
  get wishCardStyle()             { return this.props.wishCardStyle; }
  get receiveWishes()             { return this.props.receiveWishes; }
  get allowPolls()                { return this.props.allowPolls; }
  get shareableProfileLink()      { return this.props.shareableProfileLink; }

  isBirthdayToday(): boolean {
    if (!this.props.birthday) return false;
    const today = new Date();
    const [mm, dd] = this.props.birthday.split("-").map(Number);
    return today.getMonth() + 1 === mm && today.getDate() === dd;
  }

  memberAnniversaryToday(): boolean {
    const today = new Date();
    return today.getMonth() === this.props.memberSince.getMonth() &&
           today.getDate() === this.props.memberSince.getDate();
  }

  isChannelEnabled(channel: NotificationPref["channel"]): boolean {
    return this.props.notifications.some(n => n.channel === channel && n.enabled);
  }

  update(patch: Partial<Omit<UserPreferencesProps, "userId" | "memberSince">>): UserPreferences {
    return new UserPreferences({ ...this.props, ...patch, updatedAt: new Date() });
  }

  enableCalendarSync(): UserPreferences {
    return new UserPreferences({ ...this.props, calendarSyncEnabled: true, updatedAt: new Date() });
  }

  toJSON(): UserPreferencesProps {
    return {
      ...this.props,
      preferredStyles: [...this.props.preferredStyles],
      preferredTeacherIds: [...this.props.preferredTeacherIds],
      preferredClassTimes: [...this.props.preferredClassTimes],
      notifications: this.props.notifications.map(n => ({ ...n, types: [...n.types] })),
    };
  }
}

export const DEFAULT_PREFERENCES: Omit<UserPreferencesProps, "userId" | "memberSince" | "updatedAt"> = {
  timezone: "America/Vancouver",
  preferredStyles: [],
  preferredLevel: "Beginner",
  preferredTeacherIds: [],
  preferredClassTimes: ["morning"],
  goalStatement: "",
  calendarSyncEnabled: false,
  reminderMinutesBefore: 30,
  notifications: [
    { channel: "email",    enabled: true,  types: ["booking_confirmation", "subscription_renewal", "self_service_password_reset"] },
    { channel: "whatsapp", enabled: true,  types: ["booking_reminder", "waitlist_promoted", "broadcast_teacher"] },
    { channel: "push",     enabled: false, types: ["booking_reminder", "new_class_available"] },
    { channel: "in_app",   enabled: true,  types: ["challenge_completed", "streak_milestone", "pose_score_improved"] },
  ],
  birthday: undefined,
  wishCardStyle: "yoga_themed",
  receiveWishes: true,
  allowPolls: true,
  shareableProfileLink: undefined,
};
