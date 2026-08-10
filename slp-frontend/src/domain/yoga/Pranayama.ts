// Wave 19: Yoga Library — Pranayama (Breathing Technique) entity
// Table-driven: pattern/phase codes → ref_pranayama_pattern, ref_breathing_phase

export type BreathingPhase    = 'inhale' | 'hold_in' | 'exhale' | 'hold_out';
export type PranayamaPattern  = 'box' | 'ratio' | 'alternate_nostril' | 'bellows'
  | 'cooling' | 'humming' | 'ocean' | 'skull_shining';
export type DoshaType         = 'vata' | 'pitta' | 'kapha';
export type DifficultyLevel   = 'beginner' | 'intermediate' | 'advanced' | 'all_levels';

export interface RatioStep {
  phase:  BreathingPhase;
  counts: number;   // positive integer
}

export interface PranayamaProps {
  id:                string;
  tenantId:          string;
  sanskritName:      string;
  englishName:       string;
  pattern:           PranayamaPattern;
  ratioSteps:        RatioStep[];    // at least 2 steps; must include inhale + exhale
  rounds:            number;         // >= 1
  durationMinutes:   number;         // >= 1
  benefits:          string[];
  contraindications: string[];
  doshaBalance:      DoshaType[];
  difficultyLevel:   DifficultyLevel;
  isActive:          boolean;
  createdAt:         Date;
  updatedAt:         Date;
}

function validateRatioSteps(steps: RatioStep[]): void {
  if (steps.length < 2) throw new Error('ratioSteps must have at least 2 steps');
  const hasInhale  = steps.some(s => s.phase === 'inhale');
  const hasExhale  = steps.some(s => s.phase === 'exhale');
  if (!hasInhale)  throw new Error('ratioSteps must include an inhale phase');
  if (!hasExhale)  throw new Error('ratioSteps must include an exhale phase');
  steps.forEach((s, i) => {
    if (!Number.isInteger(s.counts) || s.counts < 1)
      throw new Error(`ratioSteps[${i}] counts must be a positive integer`);
  });
}

export class Pranayama {
  private readonly props: Readonly<PranayamaProps>;

  constructor(props: PranayamaProps) {
    if (!props.id?.trim())           throw new Error('id is required');
    if (!props.tenantId?.trim())     throw new Error('tenantId is required');
    if (!props.sanskritName?.trim()) throw new Error('sanskritName is required');
    if (!props.englishName?.trim())  throw new Error('englishName is required');
    if (props.rounds < 1)            throw new Error('rounds must be at least 1');
    if (props.durationMinutes < 1)   throw new Error('durationMinutes must be at least 1');
    validateRatioSteps(props.ratioSteps);

    this.props = {
      ...props,
      ratioSteps:        props.ratioSteps.map(s => ({ ...s })),
      benefits:          [...props.benefits],
      contraindications: [...props.contraindications],
      doshaBalance:      [...props.doshaBalance],
    };
  }

  get id()                { return this.props.id; }
  get tenantId()          { return this.props.tenantId; }
  get sanskritName()      { return this.props.sanskritName; }
  get englishName()       { return this.props.englishName; }
  get pattern()           { return this.props.pattern; }
  get ratioSteps()        { return this.props.ratioSteps.map(s => ({ ...s })); }
  get rounds()            { return this.props.rounds; }
  get durationMinutes()   { return this.props.durationMinutes; }
  get benefits()          { return [...this.props.benefits]; }
  get contraindications() { return [...this.props.contraindications]; }
  get doshaBalance()      { return [...this.props.doshaBalance]; }
  get difficultyLevel()   { return this.props.difficultyLevel; }
  get isActive()          { return this.props.isActive; }
  get createdAt()         { return this.props.createdAt; }
  get updatedAt()         { return this.props.updatedAt; }

  private clone(patch: Partial<PranayamaProps>): Pranayama {
    return new Pranayama({ ...this.props, ...patch });
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  addBenefit(benefit: string, now: Date): Pranayama {
    if (!benefit?.trim()) throw new Error('benefit is required');
    if (this.props.benefits.includes(benefit))
      throw new Error(`benefit "${benefit}" already added`);
    return this.clone({ benefits: [...this.props.benefits, benefit], updatedAt: now });
  }

  removeBenefit(benefit: string, now: Date): Pranayama {
    if (!this.props.benefits.includes(benefit))
      throw new Error(`benefit "${benefit}" not found`);
    return this.clone({ benefits: this.props.benefits.filter(b => b !== benefit), updatedAt: now });
  }

  addContraindication(condition: string, now: Date): Pranayama {
    if (!condition?.trim()) throw new Error('condition is required');
    if (this.props.contraindications.includes(condition))
      throw new Error(`contraindication "${condition}" already added`);
    return this.clone({ contraindications: [...this.props.contraindications, condition], updatedAt: now });
  }

  removeContraindication(condition: string, now: Date): Pranayama {
    if (!this.props.contraindications.includes(condition))
      throw new Error(`contraindication "${condition}" not found`);
    return this.clone({
      contraindications: this.props.contraindications.filter(c => c !== condition),
      updatedAt: now,
    });
  }

  setRounds(n: number, now: Date): Pranayama {
    if (n < 1) throw new Error('rounds must be at least 1');
    return this.clone({ rounds: n, updatedAt: now });
  }

  setDuration(minutes: number, now: Date): Pranayama {
    if (minutes < 1) throw new Error('durationMinutes must be at least 1');
    return this.clone({ durationMinutes: minutes, updatedAt: now });
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  totalRatioCounts(): number {
    return this.props.ratioSteps.reduce((sum, s) => sum + s.counts, 0);
  }

  cycleDescription(): string {
    return this.props.ratioSteps
      .map(s => `${s.phase}:${s.counts}`)
      .join(' — ');
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  activate(now: Date): Pranayama {
    if (this.props.isActive) throw new Error('pranayama is already active');
    return this.clone({ isActive: true, updatedAt: now });
  }

  deactivate(now: Date): Pranayama {
    if (!this.props.isActive) throw new Error('pranayama is already inactive');
    return this.clone({ isActive: false, updatedAt: now });
  }
}
