// Wave 17: Health & Wellness — Health Profile entity

export type HealthCondition =
  | 'diabetes' | 'hypertension' | 'asthma' | 'arthritis' | 'heart_disease'
  | 'osteoporosis' | 'anxiety' | 'depression' | 'migraine' | 'chronic_pain';

export type Allergy =
  | 'latex' | 'dust' | 'pollen' | 'nuts' | 'dairy' | 'gluten' | 'fragrance' | 'mold';

export type InjuryArea =
  | 'neck' | 'shoulder' | 'upper_back' | 'lower_back' | 'hip'
  | 'knee' | 'ankle' | 'wrist' | 'elbow' | 'hamstring';

export type FitnessLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface PainArea {
  area:   InjuryArea;
  level:  number;     // 0-10
  notes?: string;
}

export interface HealthProfileProps {
  id:              string;
  customerId:      string;
  conditions:      HealthCondition[];
  allergies:       Allergy[];
  injuries:        InjuryArea[];
  painAreas:       PainArea[];
  medications:     string[];
  pregnancyMode:   boolean;
  pregnancyWeek?:  number;    // 1-42
  seniorMode:      boolean;
  kidsMode:        boolean;
  fitnessLevel:    FitnessLevel;
  doctorClearance: boolean;
  doctorNotes?:    string;
  createdAt:       Date;
  updatedAt:       Date;
}

export class HealthProfile {
  private readonly props: Readonly<HealthProfileProps>;

  constructor(props: HealthProfileProps) {
    if (!props.id?.trim())         throw new Error('id is required');
    if (!props.customerId?.trim()) throw new Error('customerId is required');
    if (props.seniorMode && props.kidsMode)
      throw new Error('seniorMode and kidsMode cannot both be true');
    if (props.pregnancyMode && props.pregnancyWeek === undefined)
      throw new Error('pregnancyMode requires pregnancyWeek');
    if (props.pregnancyWeek !== undefined && (props.pregnancyWeek < 1 || props.pregnancyWeek > 42))
      throw new Error('pregnancyWeek must be 1-42');
    for (const pa of props.painAreas) {
      if (pa.level < 0 || pa.level > 10)
        throw new Error('pain level must be 0-10');
    }

    this.props = {
      ...props,
      conditions:  [...props.conditions],
      allergies:   [...props.allergies],
      injuries:    [...props.injuries],
      painAreas:   props.painAreas.map(p => ({ ...p })),
      medications: [...props.medications],
    };
  }

  get id()              { return this.props.id; }
  get customerId()      { return this.props.customerId; }
  get conditions()      { return [...this.props.conditions]; }
  get allergies()       { return [...this.props.allergies]; }
  get injuries()        { return [...this.props.injuries]; }
  get painAreas()       { return this.props.painAreas.map(p => ({ ...p })); }
  get medications()     { return [...this.props.medications]; }
  get pregnancyMode()   { return this.props.pregnancyMode; }
  get pregnancyWeek()   { return this.props.pregnancyWeek; }
  get seniorMode()      { return this.props.seniorMode; }
  get kidsMode()        { return this.props.kidsMode; }
  get fitnessLevel()    { return this.props.fitnessLevel; }
  get doctorClearance() { return this.props.doctorClearance; }
  get doctorNotes()     { return this.props.doctorNotes; }
  get createdAt()       { return this.props.createdAt; }
  get updatedAt()       { return this.props.updatedAt; }

  private clone(patch: Partial<HealthProfileProps>): HealthProfile {
    return new HealthProfile({ ...this.props, ...patch });
  }

  addCondition(condition: HealthCondition, now: Date): HealthProfile {
    if (this.props.conditions.includes(condition))
      throw new Error(`condition "${condition}" already added`);
    return this.clone({ conditions: [...this.props.conditions, condition], updatedAt: now });
  }

  removeCondition(condition: HealthCondition, now: Date): HealthProfile {
    if (!this.props.conditions.includes(condition))
      throw new Error(`condition "${condition}" not found`);
    return this.clone({ conditions: this.props.conditions.filter(c => c !== condition), updatedAt: now });
  }

  addAllergy(allergy: Allergy, now: Date): HealthProfile {
    if (this.props.allergies.includes(allergy))
      throw new Error(`allergy "${allergy}" already added`);
    return this.clone({ allergies: [...this.props.allergies, allergy], updatedAt: now });
  }

  removeAllergy(allergy: Allergy, now: Date): HealthProfile {
    if (!this.props.allergies.includes(allergy))
      throw new Error(`allergy "${allergy}" not found`);
    return this.clone({ allergies: this.props.allergies.filter(a => a !== allergy), updatedAt: now });
  }

  addInjury(area: InjuryArea, now: Date): HealthProfile {
    if (this.props.injuries.includes(area))
      throw new Error(`injury area "${area}" already added`);
    return this.clone({ injuries: [...this.props.injuries, area], updatedAt: now });
  }

  removeInjury(area: InjuryArea, now: Date): HealthProfile {
    if (!this.props.injuries.includes(area))
      throw new Error(`injury area "${area}" not found`);
    return this.clone({ injuries: this.props.injuries.filter(i => i !== area), updatedAt: now });
  }

  addPainArea(painArea: PainArea, now: Date): HealthProfile {
    if (painArea.level < 0 || painArea.level > 10)
      throw new Error('pain level must be 0-10');
    if (this.props.painAreas.some(p => p.area === painArea.area))
      throw new Error(`pain area "${painArea.area}" already exists`);
    return this.clone({ painAreas: [...this.props.painAreas, { ...painArea }], updatedAt: now });
  }

  updatePainLevel(area: InjuryArea, level: number, now: Date): HealthProfile {
    if (level < 0 || level > 10) throw new Error('pain level must be 0-10');
    const idx = this.props.painAreas.findIndex(p => p.area === area);
    if (idx === -1) throw new Error(`pain area "${area}" not found`);
    const updated = this.props.painAreas.map((p, i) => i === idx ? { ...p, level } : { ...p });
    return this.clone({ painAreas: updated, updatedAt: now });
  }

  removePainArea(area: InjuryArea, now: Date): HealthProfile {
    if (!this.props.painAreas.some(p => p.area === area))
      throw new Error(`pain area "${area}" not found`);
    return this.clone({ painAreas: this.props.painAreas.filter(p => p.area !== area), updatedAt: now });
  }

  addMedication(name: string, now: Date): HealthProfile {
    if (!name?.trim()) throw new Error('medication name cannot be empty');
    const trimmed = name.trim();
    if (this.props.medications.includes(trimmed))
      throw new Error(`medication "${trimmed}" already added`);
    return this.clone({ medications: [...this.props.medications, trimmed], updatedAt: now });
  }

  removeMedication(name: string, now: Date): HealthProfile {
    if (!this.props.medications.includes(name))
      throw new Error(`medication "${name}" not found`);
    return this.clone({ medications: this.props.medications.filter(m => m !== name), updatedAt: now });
  }

  setPregnancyMode(week: number, now: Date): HealthProfile {
    if (week < 1 || week > 42) throw new Error('pregnancyWeek must be 1-42');
    return this.clone({ pregnancyMode: true, pregnancyWeek: week, seniorMode: false, kidsMode: false, updatedAt: now });
  }

  clearPregnancyMode(now: Date): HealthProfile {
    return this.clone({ pregnancyMode: false, pregnancyWeek: undefined, updatedAt: now });
  }

  setSeniorMode(now: Date): HealthProfile {
    if (this.props.kidsMode) throw new Error('cannot set seniorMode when kidsMode is active');
    return this.clone({ seniorMode: true, updatedAt: now });
  }

  setKidsMode(now: Date): HealthProfile {
    if (this.props.seniorMode) throw new Error('cannot set kidsMode when seniorMode is active');
    return this.clone({ kidsMode: true, updatedAt: now });
  }

  setFitnessLevel(level: FitnessLevel, now: Date): HealthProfile {
    return this.clone({ fitnessLevel: level, updatedAt: now });
  }

  grantDoctorClearance(notes: string | undefined, now: Date): HealthProfile {
    return this.clone({ doctorClearance: true, doctorNotes: notes, updatedAt: now });
  }

  revokeDoctorClearance(now: Date): HealthProfile {
    return this.clone({ doctorClearance: false, doctorNotes: undefined, updatedAt: now });
  }
}
