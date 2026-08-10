// Wave 17: Health & Wellness — Daily Wellness Log entity

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface DailyWellnessLogProps {
  id:             string;
  customerId:     string;
  date:           string;    // YYYY-MM-DD — one log per customer per date
  sleepHours?:    number;    // 0-24
  waterMl?:       number;    // >= 0
  calorieBurn?:   number;    // >= 0
  steps?:         number;    // >= 0 integer
  heartRateBpm?:  number;    // 20-250
  mood?:          number;    // 1-5
  energyLevel?:   number;    // 1-5
  stressLevel?:   number;    // 1-10
  notes?:         string;
  createdAt:      Date;
  updatedAt:      Date;
}

export class DailyWellnessLog {
  private readonly props: Readonly<DailyWellnessLogProps>;

  constructor(props: DailyWellnessLogProps) {
    if (!props.id?.trim())         throw new Error('id is required');
    if (!props.customerId?.trim()) throw new Error('customerId is required');
    if (!DATE_RE.test(props.date)) throw new Error('date must be YYYY-MM-DD format');
    if (props.sleepHours   !== undefined && (props.sleepHours < 0 || props.sleepHours > 24))
      throw new Error('sleepHours must be 0-24');
    if (props.waterMl      !== undefined && props.waterMl < 0)
      throw new Error('waterMl cannot be negative');
    if (props.calorieBurn  !== undefined && props.calorieBurn < 0)
      throw new Error('calorieBurn cannot be negative');
    if (props.steps        !== undefined && props.steps < 0)
      throw new Error('steps cannot be negative');
    if (props.heartRateBpm !== undefined && (props.heartRateBpm < 20 || props.heartRateBpm > 250))
      throw new Error('heartRateBpm must be 20-250');
    if (props.mood         !== undefined && (props.mood < 1 || props.mood > 5))
      throw new Error('mood must be 1-5');
    if (props.energyLevel  !== undefined && (props.energyLevel < 1 || props.energyLevel > 5))
      throw new Error('energyLevel must be 1-5');
    if (props.stressLevel  !== undefined && (props.stressLevel < 1 || props.stressLevel > 10))
      throw new Error('stressLevel must be 1-10');

    this.props = { ...props };
  }

  get id()            { return this.props.id; }
  get customerId()    { return this.props.customerId; }
  get date()          { return this.props.date; }
  get sleepHours()    { return this.props.sleepHours; }
  get waterMl()       { return this.props.waterMl; }
  get calorieBurn()   { return this.props.calorieBurn; }
  get steps()         { return this.props.steps; }
  get heartRateBpm()  { return this.props.heartRateBpm; }
  get mood()          { return this.props.mood; }
  get energyLevel()   { return this.props.energyLevel; }
  get stressLevel()   { return this.props.stressLevel; }
  get notes()         { return this.props.notes; }
  get createdAt()     { return this.props.createdAt; }
  get updatedAt()     { return this.props.updatedAt; }

  wellnessScore(): number | undefined {
    const scores: number[] = [];
    if (this.props.mood         !== undefined) scores.push((this.props.mood / 5) * 100);
    if (this.props.energyLevel  !== undefined) scores.push((this.props.energyLevel / 5) * 100);
    if (this.props.stressLevel  !== undefined) scores.push(((11 - this.props.stressLevel) / 10) * 100);
    if (scores.length === 0) return undefined;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  isComplete(): boolean {
    return (
      this.props.sleepHours  !== undefined &&
      this.props.waterMl     !== undefined &&
      this.props.mood        !== undefined &&
      this.props.energyLevel !== undefined &&
      this.props.stressLevel !== undefined
    );
  }

  private clone(patch: Partial<DailyWellnessLogProps>): DailyWellnessLog {
    return new DailyWellnessLog({ ...this.props, ...patch });
  }

  logSleep(hours: number, now: Date): DailyWellnessLog {
    if (hours < 0 || hours > 24) throw new Error('sleepHours must be 0-24');
    return this.clone({ sleepHours: hours, updatedAt: now });
  }

  logWater(ml: number, now: Date): DailyWellnessLog {
    if (ml < 0) throw new Error('waterMl cannot be negative');
    return this.clone({ waterMl: ml, updatedAt: now });
  }

  logCalories(calories: number, now: Date): DailyWellnessLog {
    if (calories < 0) throw new Error('calorieBurn cannot be negative');
    return this.clone({ calorieBurn: calories, updatedAt: now });
  }

  logSteps(steps: number, now: Date): DailyWellnessLog {
    if (steps < 0) throw new Error('steps cannot be negative');
    return this.clone({ steps, updatedAt: now });
  }

  logHeartRate(bpm: number, now: Date): DailyWellnessLog {
    if (bpm < 20 || bpm > 250) throw new Error('heartRateBpm must be 20-250');
    return this.clone({ heartRateBpm: bpm, updatedAt: now });
  }

  logMood(level: number, now: Date): DailyWellnessLog {
    if (level < 1 || level > 5) throw new Error('mood must be 1-5');
    return this.clone({ mood: level, updatedAt: now });
  }

  logEnergyLevel(level: number, now: Date): DailyWellnessLog {
    if (level < 1 || level > 5) throw new Error('energyLevel must be 1-5');
    return this.clone({ energyLevel: level, updatedAt: now });
  }

  logStressLevel(level: number, now: Date): DailyWellnessLog {
    if (level < 1 || level > 10) throw new Error('stressLevel must be 1-10');
    return this.clone({ stressLevel: level, updatedAt: now });
  }

  addNotes(notes: string, now: Date): DailyWellnessLog {
    if (!notes?.trim()) throw new Error('notes cannot be empty');
    return this.clone({ notes, updatedAt: now });
  }
}
