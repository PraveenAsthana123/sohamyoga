// Wave 16: Customer Journey Management — Milestone & Reward entity

export type MilestoneType =
  | 'first_class'
  | 'streak_7'
  | 'streak_30'
  | 'streak_90'
  | 'streak_365'
  | 'classes_10'
  | 'classes_50'
  | 'classes_100'
  | 'classes_500'
  | 'goal_achieved'
  | 'phase_advanced'
  | 'year_anniversary'
  | 'referral_bonus';

export type RewardType = 'badge' | 'points' | 'coupon' | 'free_class' | 'certificate' | 'gift';

export interface MilestoneRewardProps {
  id:           string;
  customerId:   string;
  journeyId:    string;
  milestoneType: MilestoneType;
  label:        string;
  rewardType:   RewardType;
  rewardValue:  string;       // e.g. "500 points", "YOGA50", "Free Yin class"
  claimed:      boolean;
  claimedAt?:   Date;
  achievedAt:   Date;
  expiresAt?:   Date;
  metadata:     Record<string, unknown>;
}

export class MilestoneReward {
  private readonly props: Readonly<MilestoneRewardProps>;

  constructor(props: MilestoneRewardProps) {
    if (!props.id?.trim())          throw new Error('id is required');
    if (!props.customerId?.trim())  throw new Error('customerId is required');
    if (!props.journeyId?.trim())   throw new Error('journeyId is required');
    if (!props.label?.trim())       throw new Error('label is required');
    if (!props.rewardValue?.trim()) throw new Error('rewardValue is required');
    if (props.claimed && !props.claimedAt)
      throw new Error('claimed reward must have claimedAt');
    if (props.expiresAt && props.expiresAt <= props.achievedAt)
      throw new Error('expiresAt must be after achievedAt');

    this.props = { ...props, metadata: { ...props.metadata } };
  }

  get id()            { return this.props.id; }
  get customerId()    { return this.props.customerId; }
  get journeyId()     { return this.props.journeyId; }
  get milestoneType() { return this.props.milestoneType; }
  get label()         { return this.props.label; }
  get rewardType()    { return this.props.rewardType; }
  get rewardValue()   { return this.props.rewardValue; }
  get claimed()       { return this.props.claimed; }
  get claimedAt()     { return this.props.claimedAt; }
  get achievedAt()    { return this.props.achievedAt; }
  get expiresAt()     { return this.props.expiresAt; }
  get metadata()      { return { ...this.props.metadata }; }

  isExpired(now: Date): boolean {
    return this.props.expiresAt !== undefined && now >= this.props.expiresAt;
  }

  isClaimed() { return this.props.claimed; }

  private clone(patch: Partial<MilestoneRewardProps>): MilestoneReward {
    return new MilestoneReward({ ...this.props, ...patch });
  }

  claim(now: Date): MilestoneReward {
    if (this.props.claimed)     throw new Error('reward is already claimed');
    if (this.isExpired(now))    throw new Error('reward has expired');
    return this.clone({ claimed: true, claimedAt: now });
  }
}
