// Milestone — significant threshold-based achievement with rewards
// Challenge — time-bound group/individual participation contest
// Inspired by Habitica's challenge and milestone concepts — custom yoga implementation.

export type MilestoneType =
  | 'class_count'       // 10, 30, 50, 100, 200, 500 classes
  | 'streak_days'       // 7, 14, 30, 90, 180, 365 consecutive practice days
  | 'pose_mastery'      // reach master level on any pose
  | 'enrollment_tenure' // 6 months, 1 year, 2 years active student
  | 'referral'          // 1, 3, 5, 10 successful referrals
  | 'wellness_streak'   // 7, 30 consecutive wellness log entries
  | 'community';        // 10, 50 community posts or comments

export type MilestoneStatus = 'locked' | 'in_progress' | 'earned' | 'claimed';

export type ChallengeType   = 'individual' | 'group' | 'teacher_vs_students' | 'studio_wide';
export type ChallengeStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

export interface MilestoneReward {
  xpAmount:        number;
  pointsAmount:    number;
  badgeId?:        string;
  couponCode?:     string;
  unlockFeature?:  string;
}

export interface MilestoneProps {
  id:               string;
  userId:           string;
  milestoneType:    MilestoneType;
  threshold:        number;        // e.g. 30 (classes), 7 (days)
  currentProgress:  number;
  status:           MilestoneStatus;
  reward:           MilestoneReward;
  earnedAt?:        Date;
  claimedAt?:       Date;
  createdAt:        Date;
  updatedAt:        Date;
}

export class Milestone {
  private readonly props: Readonly<MilestoneProps>;

  constructor(props: MilestoneProps) {
    if (!props.id)                throw new Error('id is required');
    if (!props.userId)            throw new Error('userId is required');
    if (props.threshold <= 0)     throw new Error('threshold must be positive');
    if (props.currentProgress < 0)throw new Error('currentProgress cannot be negative');
    if (props.status === 'earned'  && !props.earnedAt)  throw new Error('earnedAt required when status is earned');
    if (props.status === 'claimed' && !props.claimedAt) throw new Error('claimedAt required when status is claimed');
    if (props.reward.xpAmount < 0 || props.reward.pointsAmount < 0)
      throw new Error('reward values must be non-negative');
    this.props = Object.freeze({ ...props, reward: { ...props.reward } });
  }

  private clone(patch: Partial<MilestoneProps>): Milestone {
    return new Milestone({ ...this.props, ...patch });
  }

  get id()              { return this.props.id; }
  get userId()          { return this.props.userId; }
  get milestoneType()   { return this.props.milestoneType; }
  get threshold()       { return this.props.threshold; }
  get currentProgress() { return this.props.currentProgress; }
  get status()          { return this.props.status; }
  get reward()          { return { ...this.props.reward }; }
  get earnedAt()        { return this.props.earnedAt; }
  get claimedAt()       { return this.props.claimedAt; }
  get updatedAt()       { return this.props.updatedAt; }

  progressPercent(): number {
    return Math.min(100, Math.round((this.props.currentProgress / this.props.threshold) * 100));
  }

  isComplete(): boolean {
    return this.props.currentProgress >= this.props.threshold;
  }

  isClaimed(): boolean {
    return this.props.status === 'claimed';
  }

  /** Record new progress. Auto-earns when threshold is reached. */
  advance(newProgress: number, at: Date): Milestone {
    if (this.props.status === 'earned' || this.props.status === 'claimed')
      return this;
    const clamped = Math.max(this.props.currentProgress, newProgress);
    if (clamped >= this.props.threshold) {
      return this.clone({ currentProgress: clamped, status: 'earned', earnedAt: at, updatedAt: at });
    }
    return this.clone({
      currentProgress: clamped,
      status: 'in_progress',
      updatedAt: at,
    });
  }

  claim(at: Date): Milestone {
    if (this.props.status !== 'earned')
      throw new Error(`Can only claim earned milestones, current status: ${this.props.status}`);
    return this.clone({ status: 'claimed', claimedAt: at, updatedAt: at });
  }
}

// ── Challenge ──────────────────────────────────────────────────────────────

export interface ChallengeProps {
  id:               string;
  tenantId:         string;
  name:             string;
  description:      string;
  type:             ChallengeType;
  status:           ChallengeStatus;
  metric:           string;          // 'classes_attended' | 'practice_days' | 'poses_mastered' | ...
  targetValue:      number;
  startDate:        Date;
  endDate:          Date;
  participantCount: number;
  reward:           MilestoneReward;
  createdBy:        string;
  createdAt:        Date;
  updatedAt:        Date;
}

export class Challenge {
  private readonly props: Readonly<ChallengeProps>;

  constructor(props: ChallengeProps) {
    if (!props.name.trim())      throw new Error('Challenge name is required');
    if (props.targetValue <= 0)  throw new Error('targetValue must be positive');
    if (props.endDate <= props.startDate) throw new Error('endDate must be after startDate');
    this.props = Object.freeze({ ...props, reward: { ...props.reward } });
  }

  private clone(patch: Partial<ChallengeProps>): Challenge {
    return new Challenge({ ...this.props, ...patch });
  }

  get id()               { return this.props.id; }
  get name()             { return this.props.name; }
  get type()             { return this.props.type; }
  get status()           { return this.props.status; }
  get metric()           { return this.props.metric; }
  get targetValue()      { return this.props.targetValue; }
  get startDate()        { return this.props.startDate; }
  get endDate()          { return this.props.endDate; }
  get participantCount() { return this.props.participantCount; }
  get reward()           { return { ...this.props.reward }; }
  get updatedAt()        { return this.props.updatedAt; }

  isLive(now: Date): boolean {
    return this.props.status === 'active' && this.props.startDate <= now && this.props.endDate >= now;
  }

  daysRemaining(now: Date): number {
    return Math.max(0, Math.ceil((this.props.endDate.getTime() - now.getTime()) / 86400000));
  }

  activate(at: Date): Challenge {
    if (this.props.status !== 'upcoming') throw new Error('Only upcoming challenges can be activated');
    return this.clone({ status: 'active', updatedAt: at });
  }

  complete(at: Date): Challenge {
    if (this.props.status !== 'active') throw new Error('Only active challenges can be completed');
    return this.clone({ status: 'completed', updatedAt: at });
  }

  cancel(at: Date): Challenge {
    if (this.props.status === 'completed') throw new Error('Cannot cancel a completed challenge');
    return this.clone({ status: 'cancelled', updatedAt: at });
  }

  addParticipant(at: Date): Challenge {
    if (!this.isLive(at)) throw new Error('Cannot join a challenge that is not live');
    return this.clone({ participantCount: this.props.participantCount + 1, updatedAt: at });
  }
}

// ── ChallengeParticipation ────────────────────────────────────────────────

export interface ChallengeParticipationProps {
  challengeId:     string;
  userId:          string;
  currentProgress: number;
  rank?:           number;
  joinedAt:        Date;
  completedAt?:    Date;
  updatedAt:       Date;
}

export class ChallengeParticipation {
  private readonly props: Readonly<ChallengeParticipationProps>;

  constructor(props: ChallengeParticipationProps) {
    if (!props.challengeId) throw new Error('challengeId is required');
    if (!props.userId)       throw new Error('userId is required');
    if (props.currentProgress < 0) throw new Error('progress cannot be negative');
    this.props = Object.freeze({ ...props });
  }

  get challengeId()     { return this.props.challengeId; }
  get userId()          { return this.props.userId; }
  get currentProgress() { return this.props.currentProgress; }
  get rank()            { return this.props.rank; }
  get completedAt()     { return this.props.completedAt; }
  get updatedAt()       { return this.props.updatedAt; }

  recordProgress(newProgress: number, target: number, at: Date): ChallengeParticipation {
    const updated = Math.max(this.props.currentProgress, newProgress);
    const isComplete = updated >= target;
    return new ChallengeParticipation({
      ...this.props,
      currentProgress: updated,
      completedAt: isComplete && !this.props.completedAt ? at : this.props.completedAt,
      updatedAt: at,
    });
  }

  updateRank(rank: number, at: Date): ChallengeParticipation {
    if (rank < 1) throw new Error('rank must be >= 1');
    return new ChallengeParticipation({ ...this.props, rank, updatedAt: at });
  }
}

// ── Milestone catalog seed data ───────────────────────────────────────────

export interface MilestoneDef {
  milestoneType: MilestoneType;
  threshold:     number;
  label:         string;
  reward:        MilestoneReward;
}

export const MILESTONE_CATALOG: MilestoneDef[] = [
  { milestoneType: 'class_count',       threshold: 10,  label: '10 Classes',          reward: { xpAmount: 100, pointsAmount: 50 } },
  { milestoneType: 'class_count',       threshold: 30,  label: '30 Classes',          reward: { xpAmount: 200, pointsAmount: 100, badgeId: 'b3' } },
  { milestoneType: 'class_count',       threshold: 50,  label: '50 Classes',          reward: { xpAmount: 350, pointsAmount: 200 } },
  { milestoneType: 'class_count',       threshold: 100, label: '100 Classes',         reward: { xpAmount: 500, pointsAmount: 500, badgeId: 'b4' } },
  { milestoneType: 'streak_days',       threshold: 7,   label: '7-Day Streak',        reward: { xpAmount: 150, pointsAmount: 75,  badgeId: 'b5' } },
  { milestoneType: 'streak_days',       threshold: 30,  label: '30-Day Streak',       reward: { xpAmount: 400, pointsAmount: 300, badgeId: 'b6' } },
  { milestoneType: 'streak_days',       threshold: 90,  label: '90-Day Streak',       reward: { xpAmount: 800, pointsAmount: 750 } },
  { milestoneType: 'pose_mastery',      threshold: 1,   label: 'First Pose Mastered', reward: { xpAmount: 120, pointsAmount: 60,  badgeId: 'b7' } },
  { milestoneType: 'enrollment_tenure', threshold: 180, label: '6-Month Student',     reward: { xpAmount: 300, pointsAmount: 150, couponCode: 'LOYAL6' } },
  { milestoneType: 'enrollment_tenure', threshold: 365, label: '1-Year Anniversary',  reward: { xpAmount: 600, pointsAmount: 400, couponCode: 'LOYAL12' } },
  { milestoneType: 'referral',          threshold: 1,   label: 'First Referral',      reward: { xpAmount: 100, pointsAmount: 100 } },
  { milestoneType: 'referral',          threshold: 3,   label: 'Referral Champion',   reward: { xpAmount: 300, pointsAmount: 300, badgeId: 'b10' } },
  { milestoneType: 'community',         threshold: 10,  label: '10 Community Posts',  reward: { xpAmount: 100, pointsAmount: 50,  badgeId: 'b9' } },
];
