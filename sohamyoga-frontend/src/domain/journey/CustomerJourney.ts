// Wave 16: Customer Journey Management — Core journey entity

export type JourneyPhase   = 'onboarding' | 'beginner' | 'intermediate' | 'advanced' | 'ambassador';
export type JourneyStatus  = 'new' | 'in_progress' | 'paused' | 'completed';
export type YogaStyle      = 'hatha' | 'vinyasa' | 'ashtanga' | 'yin' | 'restorative'
                           | 'kundalini' | 'iyengar' | 'prenatal' | 'kids' | 'senior';
export type PracticeGoalType = 'stress_relief' | 'flexibility' | 'strength' | 'sleep'
                             | 'weight_loss' | 'mindfulness' | 'injury_recovery'
                             | 'spiritual' | 'general_fitness';

export interface JourneyProps {
  id:                   string;
  customerId:           string;
  currentPhase:         JourneyPhase;
  status:               JourneyStatus;
  stylePreferences:     YogaStyle[];
  practiceGoals:        PracticeGoalType[];
  weeklyTargetMinutes:  number;    // >= 1
  currentStreakDays:    number;    // >= 0
  longestStreakDays:    number;    // >= 0
  totalSessionCount:    number;    // >= 0
  totalMinutes:         number;    // >= 0
  milestoneIds:         string[];
  joinedAt:             Date;
  lastPracticeAt?:      Date;
  updatedAt:            Date;
}

const PHASE_ORDER: JourneyPhase[] = ['onboarding', 'beginner', 'intermediate', 'advanced', 'ambassador'];

export class CustomerJourney {
  private readonly props: Readonly<JourneyProps>;

  constructor(props: JourneyProps) {
    if (!props.id?.trim())         throw new Error('id is required');
    if (!props.customerId?.trim()) throw new Error('customerId is required');
    if (props.weeklyTargetMinutes < 1)
      throw new Error('weeklyTargetMinutes must be at least 1');
    if (props.currentStreakDays < 0)
      throw new Error('currentStreakDays cannot be negative');
    if (props.longestStreakDays < 0)
      throw new Error('longestStreakDays cannot be negative');
    if (props.totalSessionCount < 0)
      throw new Error('totalSessionCount cannot be negative');
    if (props.totalMinutes < 0)
      throw new Error('totalMinutes cannot be negative');
    if (props.currentStreakDays > props.longestStreakDays)
      throw new Error('currentStreakDays cannot exceed longestStreakDays');
    if (props.lastPracticeAt && props.lastPracticeAt < props.joinedAt)
      throw new Error('lastPracticeAt cannot be before joinedAt');
    if (props.status === 'completed' && props.currentPhase !== 'ambassador')
      throw new Error('completed journey must be in ambassador phase');

    this.props = {
      ...props,
      stylePreferences: [...props.stylePreferences],
      practiceGoals:    [...props.practiceGoals],
      milestoneIds:     [...props.milestoneIds],
    };
  }

  get id()                  { return this.props.id; }
  get customerId()          { return this.props.customerId; }
  get currentPhase()        { return this.props.currentPhase; }
  get status()              { return this.props.status; }
  get stylePreferences()    { return [...this.props.stylePreferences]; }
  get practiceGoals()       { return [...this.props.practiceGoals]; }
  get weeklyTargetMinutes() { return this.props.weeklyTargetMinutes; }
  get currentStreakDays()   { return this.props.currentStreakDays; }
  get longestStreakDays()   { return this.props.longestStreakDays; }
  get totalSessionCount()   { return this.props.totalSessionCount; }
  get totalMinutes()        { return this.props.totalMinutes; }
  get milestoneIds()        { return [...this.props.milestoneIds]; }
  get joinedAt()            { return this.props.joinedAt; }
  get lastPracticeAt()      { return this.props.lastPracticeAt; }
  get updatedAt()           { return this.props.updatedAt; }

  isNew()         { return this.props.status === 'new';         }
  isInProgress()  { return this.props.status === 'in_progress'; }
  isPaused()      { return this.props.status === 'paused';      }
  isCompleted()   { return this.props.status === 'completed';   }
  isOnboarding()  { return this.props.currentPhase === 'onboarding';   }
  isAmbassador()  { return this.props.currentPhase === 'ambassador';   }

  phaseIndex(): number {
    return PHASE_ORDER.indexOf(this.props.currentPhase);
  }

  private clone(patch: Partial<JourneyProps>): CustomerJourney {
    return new CustomerJourney({ ...this.props, ...patch });
  }

  start(now: Date): CustomerJourney {
    if (this.props.status !== 'new') throw new Error('journey is already started');
    return this.clone({ status: 'in_progress', currentPhase: 'beginner', updatedAt: now });
  }

  pause(now: Date): CustomerJourney {
    if (this.props.status !== 'in_progress') throw new Error('can only pause an in-progress journey');
    return this.clone({ status: 'paused', updatedAt: now });
  }

  resume(now: Date): CustomerJourney {
    if (this.props.status !== 'paused') throw new Error('can only resume a paused journey');
    return this.clone({ status: 'in_progress', updatedAt: now });
  }

  complete(now: Date): CustomerJourney {
    if (this.props.status === 'completed') throw new Error('journey is already completed');
    if (this.props.currentPhase !== 'ambassador')
      throw new Error('must reach ambassador phase before completing');
    return this.clone({ status: 'completed', updatedAt: now });
  }

  advance(now: Date): CustomerJourney {
    if (this.isAmbassador()) throw new Error('already at highest phase: ambassador');
    const nextIndex = this.phaseIndex() + 1;
    return this.clone({ currentPhase: PHASE_ORDER[nextIndex], updatedAt: now });
  }

  recordSession(durationMinutes: number, practiceAt: Date, now: Date): CustomerJourney {
    if (durationMinutes < 1) throw new Error('durationMinutes must be at least 1');
    if (this.props.status !== 'in_progress') throw new Error('can only record session for in-progress journey');
    if (practiceAt < this.props.joinedAt) throw new Error('practiceAt cannot be before joinedAt');
    return this.clone({
      totalSessionCount: this.props.totalSessionCount + 1,
      totalMinutes:      this.props.totalMinutes + durationMinutes,
      lastPracticeAt:    practiceAt,
      updatedAt:         now,
    });
  }

  incrementStreak(now: Date): CustomerJourney {
    const next = this.props.currentStreakDays + 1;
    return this.clone({
      currentStreakDays: next,
      longestStreakDays: Math.max(next, this.props.longestStreakDays),
      updatedAt:         now,
    });
  }

  resetStreak(now: Date): CustomerJourney {
    return this.clone({ currentStreakDays: 0, updatedAt: now });
  }

  setWeeklyTarget(minutes: number, now: Date): CustomerJourney {
    if (minutes < 1) throw new Error('weeklyTargetMinutes must be at least 1');
    return this.clone({ weeklyTargetMinutes: minutes, updatedAt: now });
  }

  addStylePreference(style: YogaStyle, now: Date): CustomerJourney {
    if (this.props.stylePreferences.includes(style))
      throw new Error(`style "${style}" already added`);
    return this.clone({ stylePreferences: [...this.props.stylePreferences, style], updatedAt: now });
  }

  removeStylePreference(style: YogaStyle, now: Date): CustomerJourney {
    if (!this.props.stylePreferences.includes(style))
      throw new Error(`style "${style}" not found`);
    return this.clone({
      stylePreferences: this.props.stylePreferences.filter(s => s !== style),
      updatedAt: now,
    });
  }

  addGoal(goal: PracticeGoalType, now: Date): CustomerJourney {
    if (this.props.practiceGoals.includes(goal))
      throw new Error(`goal "${goal}" already added`);
    return this.clone({ practiceGoals: [...this.props.practiceGoals, goal], updatedAt: now });
  }

  removeGoal(goal: PracticeGoalType, now: Date): CustomerJourney {
    if (!this.props.practiceGoals.includes(goal))
      throw new Error(`goal "${goal}" not found`);
    return this.clone({
      practiceGoals: this.props.practiceGoals.filter(g => g !== goal),
      updatedAt: now,
    });
  }

  addMilestone(milestoneId: string, now: Date): CustomerJourney {
    if (!milestoneId?.trim()) throw new Error('milestoneId cannot be empty');
    if (this.props.milestoneIds.includes(milestoneId))
      throw new Error('milestone already recorded');
    return this.clone({ milestoneIds: [...this.props.milestoneIds, milestoneId], updatedAt: now });
  }
}
