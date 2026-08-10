// Wave 16: Customer Journey Management — Daily Habit Tracker entry

export type HabitType = 'morning_yoga' | 'meditation' | 'breathwork' | 'journaling'
                      | 'water_intake' | 'sleep_target' | 'step_count' | 'evening_yoga'
                      | 'gratitude' | 'screen_free_hour';

export interface HabitEntryProps {
  id:           string;
  customerId:   string;
  journeyId:    string;
  habitType:    HabitType;
  date:         string;       // ISO date string YYYY-MM-DD
  completed:    boolean;
  value?:       number;       // actual value (e.g. 2000 ml water, 8000 steps)
  targetValue:  number;       // target (e.g. 2500 ml, 10000 steps); >= 1
  unit?:        string;       // 'ml', 'steps', 'minutes'
  notes?:       string;
  completedAt?: Date;
  createdAt:    Date;
}

export class HabitEntry {
  private readonly props: Readonly<HabitEntryProps>;

  constructor(props: HabitEntryProps) {
    if (!props.id?.trim())         throw new Error('id is required');
    if (!props.customerId?.trim()) throw new Error('customerId is required');
    if (!props.journeyId?.trim())  throw new Error('journeyId is required');
    if (!props.date?.trim())       throw new Error('date is required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(props.date))
      throw new Error('date must be in YYYY-MM-DD format');
    if (props.targetValue < 1)
      throw new Error('targetValue must be at least 1');
    if (props.value !== undefined && props.value < 0)
      throw new Error('value cannot be negative');
    if (props.completed && !props.completedAt)
      throw new Error('completed entry must have completedAt');

    this.props = { ...props };
  }

  get id()          { return this.props.id; }
  get customerId()  { return this.props.customerId; }
  get journeyId()   { return this.props.journeyId; }
  get habitType()   { return this.props.habitType; }
  get date()        { return this.props.date; }
  get completed()   { return this.props.completed; }
  get value()       { return this.props.value; }
  get targetValue() { return this.props.targetValue; }
  get unit()        { return this.props.unit; }
  get notes()       { return this.props.notes; }
  get completedAt() { return this.props.completedAt; }
  get createdAt()   { return this.props.createdAt; }

  achievementPercent(): number {
    if (this.props.value === undefined) return this.props.completed ? 100 : 0;
    return Math.min(100, Math.round((this.props.value / this.props.targetValue) * 100));
  }

  meetsTarget(): boolean {
    if (this.props.value === undefined) return this.props.completed;
    return this.props.value >= this.props.targetValue;
  }

  private clone(patch: Partial<HabitEntryProps>): HabitEntry {
    return new HabitEntry({ ...this.props, ...patch });
  }

  complete(now: Date): HabitEntry {
    if (this.props.completed) throw new Error('habit entry is already completed');
    return this.clone({ completed: true, completedAt: now });
  }

  uncomplete(): HabitEntry {
    if (!this.props.completed) throw new Error('habit entry is not completed');
    return this.clone({ completed: false, completedAt: undefined });
  }

  setValue(value: number): HabitEntry {
    if (value < 0) throw new Error('value cannot be negative');
    return this.clone({ value });
  }

  addNotes(notes: string): HabitEntry {
    return this.clone({ notes });
  }
}
