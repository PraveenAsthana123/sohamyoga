// Wave 17: Health & Wellness — Body Metrics entity (single measurement snapshot)

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

export interface BodyMeasurements {
  chestCm?:  number;   // > 0
  waistCm?:  number;   // > 0
  hipsCm?:   number;   // > 0
  thighsCm?: number;   // > 0
  armsCm?:   number;   // > 0
}

export interface BodyMetricsProps {
  id:            string;
  customerId:    string;
  recordedAt:    Date;
  weightKg:      number;            // > 0
  heightCm:      number;            // > 0
  measurements?: BodyMeasurements;
  notes?:        string;
  createdAt:     Date;
  updatedAt:     Date;
}

function validateMeasurements(m: BodyMeasurements): void {
  if (m.chestCm  !== undefined && m.chestCm  <= 0) throw new Error('chestCm must be greater than 0');
  if (m.waistCm  !== undefined && m.waistCm  <= 0) throw new Error('waistCm must be greater than 0');
  if (m.hipsCm   !== undefined && m.hipsCm   <= 0) throw new Error('hipsCm must be greater than 0');
  if (m.thighsCm !== undefined && m.thighsCm <= 0) throw new Error('thighsCm must be greater than 0');
  if (m.armsCm   !== undefined && m.armsCm   <= 0) throw new Error('armsCm must be greater than 0');
}

export class BodyMetrics {
  private readonly props: Readonly<BodyMetricsProps>;

  constructor(props: BodyMetricsProps) {
    if (!props.id?.trim())         throw new Error('id is required');
    if (!props.customerId?.trim()) throw new Error('customerId is required');
    if (props.weightKg <= 0)       throw new Error('weightKg must be greater than 0');
    if (props.heightCm <= 0)       throw new Error('heightCm must be greater than 0');
    if (props.measurements)        validateMeasurements(props.measurements);

    this.props = {
      ...props,
      measurements: props.measurements ? { ...props.measurements } : undefined,
    };
  }

  get id()           { return this.props.id; }
  get customerId()   { return this.props.customerId; }
  get recordedAt()   { return this.props.recordedAt; }
  get weightKg()     { return this.props.weightKg; }
  get heightCm()     { return this.props.heightCm; }
  get measurements() { return this.props.measurements ? { ...this.props.measurements } : undefined; }
  get notes()        { return this.props.notes; }
  get createdAt()    { return this.props.createdAt; }
  get updatedAt()    { return this.props.updatedAt; }

  bmi(): number {
    const hm = this.props.heightCm / 100;
    return Math.round((this.props.weightKg / (hm * hm)) * 10) / 10;
  }

  bmiCategory(): BmiCategory {
    const b = this.bmi();
    if (b < 18.5) return 'underweight';
    if (b < 25)   return 'normal';
    if (b < 30)   return 'overweight';
    return 'obese';
  }

  private clone(patch: Partial<BodyMetricsProps>): BodyMetrics {
    return new BodyMetrics({ ...this.props, ...patch });
  }

  updateWeight(weightKg: number, recordedAt: Date, now: Date): BodyMetrics {
    if (weightKg <= 0) throw new Error('weightKg must be greater than 0');
    return this.clone({ weightKg, recordedAt, updatedAt: now });
  }

  updateHeight(heightCm: number, now: Date): BodyMetrics {
    if (heightCm <= 0) throw new Error('heightCm must be greater than 0');
    return this.clone({ heightCm, updatedAt: now });
  }

  updateMeasurements(measurements: BodyMeasurements, now: Date): BodyMetrics {
    validateMeasurements(measurements);
    return this.clone({ measurements: { ...measurements }, updatedAt: now });
  }

  addNotes(notes: string, now: Date): BodyMetrics {
    if (!notes?.trim()) throw new Error('notes cannot be empty');
    return this.clone({ notes, updatedAt: now });
  }
}
