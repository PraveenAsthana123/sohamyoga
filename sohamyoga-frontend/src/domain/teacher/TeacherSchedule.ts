// Wave 18: Teacher Management — Teacher Schedule entity
// Table-driven: dayOfWeek and blockType codes → ref_day_of_week, ref_block_type
// Tenant-driven: tenantId on every instance
// API-driven: isBlockedOnDate() supports availability API; Cal.com sync via API

const TIME_RE = /^\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DayOfWeek  = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type BlockType  = 'holiday' | 'vacation' | 'personal' | 'training' | 'meeting' | 'sick_leave';
export type ScheduleStatus = 'draft' | 'active' | 'archived';

export interface TimeSlot {
  dayOfWeek:   DayOfWeek;
  startTime:   string;     // HH:MM 24h
  endTime:     string;     // HH:MM 24h, must be > startTime
  location?:   string;
  isRecurring: boolean;
}

export interface BlockedPeriod {
  id:        string;
  type:      BlockType;
  startDate: string;    // YYYY-MM-DD
  endDate:   string;    // YYYY-MM-DD, >= startDate
  reason?:   string;
}

export interface TeacherScheduleProps {
  id:             string;
  teacherId:      string;
  tenantId:       string;
  status:         ScheduleStatus;
  weeklySlots:    TimeSlot[];
  blockedPeriods: BlockedPeriod[];
  timezone:       string;
  effectiveFrom:  Date;
  effectiveTo?:   Date;
  createdAt:      Date;
  updatedAt:      Date;
}

function validateTimeSlot(slot: TimeSlot): void {
  if (!TIME_RE.test(slot.startTime)) throw new Error('startTime must be HH:MM format');
  if (!TIME_RE.test(slot.endTime))   throw new Error('endTime must be HH:MM format');
  if (slot.endTime <= slot.startTime) throw new Error('endTime must be after startTime');
}

function validateBlockedPeriod(period: BlockedPeriod): void {
  if (!period.id?.trim())          throw new Error('blocked period id is required');
  if (!DATE_RE.test(period.startDate)) throw new Error('startDate must be YYYY-MM-DD format');
  if (!DATE_RE.test(period.endDate))   throw new Error('endDate must be YYYY-MM-DD format');
  if (period.endDate < period.startDate)
    throw new Error('endDate must be on or after startDate');
}

export class TeacherSchedule {
  private readonly props: Readonly<TeacherScheduleProps>;

  constructor(props: TeacherScheduleProps) {
    if (!props.id?.trim())        throw new Error('id is required');
    if (!props.teacherId?.trim()) throw new Error('teacherId is required');
    if (!props.tenantId?.trim())  throw new Error('tenantId is required');
    if (!props.timezone?.trim())  throw new Error('timezone is required');
    if (props.effectiveTo && props.effectiveTo <= props.effectiveFrom)
      throw new Error('effectiveTo must be after effectiveFrom');
    props.weeklySlots.forEach(validateTimeSlot);
    props.blockedPeriods.forEach(validateBlockedPeriod);

    this.props = {
      ...props,
      weeklySlots:    props.weeklySlots.map(s => ({ ...s })),
      blockedPeriods: props.blockedPeriods.map(p => ({ ...p })),
    };
  }

  get id()              { return this.props.id; }
  get teacherId()       { return this.props.teacherId; }
  get tenantId()        { return this.props.tenantId; }
  get status()          { return this.props.status; }
  get weeklySlots()     { return this.props.weeklySlots.map(s => ({ ...s })); }
  get blockedPeriods()  { return this.props.blockedPeriods.map(p => ({ ...p })); }
  get timezone()        { return this.props.timezone; }
  get effectiveFrom()   { return this.props.effectiveFrom; }
  get effectiveTo()     { return this.props.effectiveTo; }
  get createdAt()       { return this.props.createdAt; }
  get updatedAt()       { return this.props.updatedAt; }

  isDraft()    { return this.props.status === 'draft';    }
  isActive()   { return this.props.status === 'active';   }
  isArchived() { return this.props.status === 'archived'; }

  private clone(patch: Partial<TeacherScheduleProps>): TeacherSchedule {
    return new TeacherSchedule({ ...this.props, ...patch });
  }

  activate(now: Date): TeacherSchedule {
    if (this.props.status !== 'draft')
      throw new Error('can only activate a draft schedule');
    return this.clone({ status: 'active', updatedAt: now });
  }

  archive(now: Date): TeacherSchedule {
    if (this.props.status !== 'active')
      throw new Error('can only archive an active schedule');
    return this.clone({ status: 'archived', updatedAt: now });
  }

  addTimeSlot(slot: TimeSlot, now: Date): TeacherSchedule {
    validateTimeSlot(slot);
    const duplicate = this.props.weeklySlots.some(
      s => s.dayOfWeek === slot.dayOfWeek && s.startTime === slot.startTime
    );
    if (duplicate) throw new Error(`time slot ${slot.dayOfWeek} ${slot.startTime} already exists`);
    return this.clone({ weeklySlots: [...this.props.weeklySlots, { ...slot }], updatedAt: now });
  }

  removeTimeSlot(dayOfWeek: DayOfWeek, startTime: string, now: Date): TeacherSchedule {
    const idx = this.props.weeklySlots.findIndex(
      s => s.dayOfWeek === dayOfWeek && s.startTime === startTime
    );
    if (idx === -1) throw new Error(`time slot ${dayOfWeek} ${startTime} not found`);
    return this.clone({
      weeklySlots: this.props.weeklySlots.filter((_, i) => i !== idx),
      updatedAt:   now,
    });
  }

  addBlockedPeriod(period: BlockedPeriod, now: Date): TeacherSchedule {
    validateBlockedPeriod(period);
    if (this.props.blockedPeriods.some(p => p.id === period.id))
      throw new Error(`blocked period "${period.id}" already exists`);
    return this.clone({ blockedPeriods: [...this.props.blockedPeriods, { ...period }], updatedAt: now });
  }

  removeBlockedPeriod(id: string, now: Date): TeacherSchedule {
    if (!this.props.blockedPeriods.some(p => p.id === id))
      throw new Error(`blocked period "${id}" not found`);
    return this.clone({ blockedPeriods: this.props.blockedPeriods.filter(p => p.id !== id), updatedAt: now });
  }

  isBlockedOnDate(date: string): boolean {
    if (!DATE_RE.test(date)) throw new Error('date must be YYYY-MM-DD format');
    return this.props.blockedPeriods.some(p => date >= p.startDate && date <= p.endDate);
  }

  setEffectiveTo(date: Date, now: Date): TeacherSchedule {
    if (date <= this.props.effectiveFrom)
      throw new Error('effectiveTo must be after effectiveFrom');
    return this.clone({ effectiveTo: date, updatedAt: now });
  }
}
