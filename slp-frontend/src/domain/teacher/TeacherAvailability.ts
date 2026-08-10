// Teacher availability — regular weekly windows + blocked periods
// Source of truth synced to Cal.com; blocked periods trigger substitute workflow

export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type BlockReason = "vacation" | "holiday" | "sick" | "personal" | "training" | "conference";

export interface TimeWindow {
  dayOfWeek: DayOfWeek;
  startHour: number;    // 0–23
  startMinute: number;  // 0 or 30
  endHour: number;
  endMinute: number;
}

export interface BlockedPeriod {
  id: string;
  reason: BlockReason;
  label: string;        // "Summer vacation", "Yoga Alliance training"
  startAt: Date;
  endAt: Date;
  notifyStudents: boolean;
}

export interface TeacherAvailabilityProps {
  id: string;
  teacherId: string;
  timezone: string;
  weeklyWindows: TimeWindow[];
  blockedPeriods: BlockedPeriod[];
  defaultClassDurationMinutes: number;
  bufferMinutes: number;          // gap required between consecutive classes
  maxClassesPerDay: number;
  maxClassesPerWeek: number;
  allowOnlineBooking: boolean;
  notes: string;
  updatedAt: Date;
}

export class TeacherAvailability {
  constructor(private props: TeacherAvailabilityProps) {
    if (!props.teacherId.trim()) throw new Error("Teacher ID required");
    if (props.defaultClassDurationMinutes < 1) throw new Error("Class duration must be >= 1 minute");
    if (props.bufferMinutes < 0) throw new Error("Buffer cannot be negative");
    if (props.maxClassesPerDay < 0) throw new Error("Max classes per day cannot be negative");
    if (props.maxClassesPerWeek < 0) throw new Error("Max classes per week cannot be negative");
    for (const w of props.weeklyWindows) {
      const startTotal = w.startHour * 60 + w.startMinute;
      const endTotal   = w.endHour   * 60 + w.endMinute;
      if (endTotal <= startTotal) throw new Error(`Window end must be after start on ${w.dayOfWeek}`);
    }
    for (const b of props.blockedPeriods) {
      if (b.endAt <= b.startAt) throw new Error(`Blocked period end must be after start: ${b.label}`);
    }
  }

  get id()                           { return this.props.id; }
  get teacherId()                    { return this.props.teacherId; }
  get timezone()                     { return this.props.timezone; }
  get weeklyWindows()                { return this.props.weeklyWindows.map(w => ({ ...w })); }
  get blockedPeriods()               { return this.props.blockedPeriods.map(b => ({ ...b })); }
  get defaultClassDurationMinutes()  { return this.props.defaultClassDurationMinutes; }
  get bufferMinutes()                { return this.props.bufferMinutes; }
  get maxClassesPerDay()             { return this.props.maxClassesPerDay; }
  get maxClassesPerWeek()            { return this.props.maxClassesPerWeek; }
  get allowOnlineBooking()           { return this.props.allowOnlineBooking; }

  windowsForDay(day: DayOfWeek): TimeWindow[] {
    return this.props.weeklyWindows.filter(w => w.dayOfWeek === day).map(w => ({ ...w }));
  }

  isBlockedOn(date: Date): boolean {
    return this.props.blockedPeriods.some(b => date >= b.startAt && date <= b.endAt);
  }

  upcomingBlocks(from: Date): BlockedPeriod[] {
    return this.props.blockedPeriods
      .filter(b => b.endAt > from)
      .map(b => ({ ...b }))
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }

  addBlockedPeriod(period: BlockedPeriod): TeacherAvailability {
    return new TeacherAvailability({
      ...this.props,
      blockedPeriods: [...this.props.blockedPeriods, period],
      updatedAt: new Date(),
    });
  }

  removeBlockedPeriod(id: string): TeacherAvailability {
    return new TeacherAvailability({
      ...this.props,
      blockedPeriods: this.props.blockedPeriods.filter(b => b.id !== id),
      updatedAt: new Date(),
    });
  }

  addWindow(window: TimeWindow): TeacherAvailability {
    return new TeacherAvailability({
      ...this.props,
      weeklyWindows: [...this.props.weeklyWindows, window],
      updatedAt: new Date(),
    });
  }

  removeWindowsForDay(day: DayOfWeek): TeacherAvailability {
    return new TeacherAvailability({
      ...this.props,
      weeklyWindows: this.props.weeklyWindows.filter(w => w.dayOfWeek !== day),
      updatedAt: new Date(),
    });
  }

  toJSON(): TeacherAvailabilityProps {
    return {
      ...this.props,
      weeklyWindows: this.props.weeklyWindows.map(w => ({ ...w })),
      blockedPeriods: this.props.blockedPeriods.map(b => ({ ...b })),
    };
  }
}
