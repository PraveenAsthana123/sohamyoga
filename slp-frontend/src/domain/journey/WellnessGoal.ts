// Wave 16: Customer Journey Management — Wellness Goal entity

export type GoalType   = 'stress_relief' | 'flexibility' | 'strength' | 'sleep'
                       | 'weight_loss' | 'mindfulness' | 'injury_recovery'
                       | 'spiritual' | 'general_fitness';
export type GoalStatus = 'active' | 'achieved' | 'abandoned';

export interface WellnessGoalProps {
  id:           string;
  customerId:   string;
  journeyId:    string;
  goalType:     GoalType;
  description:  string;
  progress:     number;      // 0-100
  status:       GoalStatus;
  targetDate?:  Date;
  achievedAt?:  Date;
  createdAt:    Date;
  updatedAt:    Date;
}

export class WellnessGoal {
  private readonly props: Readonly<WellnessGoalProps>;

  constructor(props: WellnessGoalProps) {
    if (!props.id?.trim())          throw new Error('id is required');
    if (!props.customerId?.trim())  throw new Error('customerId is required');
    if (!props.journeyId?.trim())   throw new Error('journeyId is required');
    if (!props.description?.trim()) throw new Error('description is required');
    if (props.progress < 0 || props.progress > 100)
      throw new Error('progress must be 0-100');
    if (props.targetDate && props.targetDate <= props.createdAt)
      throw new Error('targetDate must be after createdAt');
    if (props.status === 'achieved' && !props.achievedAt)
      throw new Error('achieved goal must have achievedAt');
    if (props.status === 'achieved' && props.progress !== 100)
      throw new Error('achieved goal must have progress 100');

    this.props = { ...props };
  }

  get id()          { return this.props.id; }
  get customerId()  { return this.props.customerId; }
  get journeyId()   { return this.props.journeyId; }
  get goalType()    { return this.props.goalType; }
  get description() { return this.props.description; }
  get progress()    { return this.props.progress; }
  get status()      { return this.props.status; }
  get targetDate()  { return this.props.targetDate; }
  get achievedAt()  { return this.props.achievedAt; }
  get createdAt()   { return this.props.createdAt; }
  get updatedAt()   { return this.props.updatedAt; }

  isActive()    { return this.props.status === 'active';    }
  isAchieved()  { return this.props.status === 'achieved';  }
  isAbandoned() { return this.props.status === 'abandoned'; }

  private clone(patch: Partial<WellnessGoalProps>): WellnessGoal {
    return new WellnessGoal({ ...this.props, ...patch });
  }

  updateProgress(pct: number, now: Date): WellnessGoal {
    if (pct < 0 || pct > 100) throw new Error('progress must be 0-100');
    if (this.props.status !== 'active') throw new Error('can only update progress on an active goal');
    return this.clone({ progress: pct, updatedAt: now });
  }

  achieve(now: Date): WellnessGoal {
    if (this.props.status === 'achieved')  throw new Error('goal is already achieved');
    if (this.props.status === 'abandoned') throw new Error('cannot achieve an abandoned goal');
    return this.clone({ status: 'achieved', progress: 100, achievedAt: now, updatedAt: now });
  }

  abandon(now: Date): WellnessGoal {
    if (this.props.status === 'abandoned') throw new Error('goal is already abandoned');
    if (this.props.status === 'achieved')  throw new Error('cannot abandon an achieved goal');
    return this.clone({ status: 'abandoned', updatedAt: now });
  }

  extendTargetDate(newDate: Date, now: Date): WellnessGoal {
    if (this.props.status !== 'active') throw new Error('can only extend an active goal');
    if (newDate <= this.props.createdAt)
      throw new Error('targetDate must be after createdAt');
    if (this.props.targetDate && newDate <= this.props.targetDate)
      throw new Error('new targetDate must be later than current targetDate');
    return this.clone({ targetDate: newDate, updatedAt: now });
  }

  updateDescription(description: string, now: Date): WellnessGoal {
    if (!description?.trim()) throw new Error('description cannot be empty');
    return this.clone({ description, updatedAt: now });
  }
}
