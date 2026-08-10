export type ChallengeType = "streak" | "class_count" | "pose_score" | "style_variety" | "custom";

export interface ChallengeProps {
  id: string;
  createdById: string;   // teacher or admin
  title: string;
  description: string;
  type: ChallengeType;
  goal: number;          // e.g. 7 (days), 30 (classes), 85 (pose score)
  rewardLabel: string;   // "🏅 Sunrise Warrior"
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  maxParticipants?: number;
}

export interface ParticipationProps {
  id: string;
  challengeId: string;
  studentId: string;
  progress: number;
  completedAt?: Date;
  joinedAt: Date;
}

export class Challenge {
  constructor(private readonly props: ChallengeProps) {
    if (props.endDate <= props.startDate) throw new Error("End date must be after start date");
    if (props.goal < 1) throw new Error("Goal must be >= 1");
    if (!props.title.trim()) throw new Error("Title is required");
  }

  get id()               { return this.props.id; }
  get title()            { return this.props.title; }
  get description()      { return this.props.description; }
  get type()             { return this.props.type; }
  get goal()             { return this.props.goal; }
  get rewardLabel()      { return this.props.rewardLabel; }
  get startDate()        { return this.props.startDate; }
  get endDate()          { return this.props.endDate; }
  get isActive()         { return this.props.isActive; }
  get maxParticipants()  { return this.props.maxParticipants; }

  isLive(): boolean { return this.props.isActive && new Date() >= this.props.startDate && new Date() <= this.props.endDate; }
  daysRemaining(): number { return Math.max(0, Math.ceil((this.props.endDate.getTime() - Date.now()) / 86400000)); }

  toJSON(): ChallengeProps { return { ...this.props }; }
}

export class ChallengeParticipation {
  constructor(private props: ParticipationProps) {
    if (props.progress < 0) throw new Error("Progress cannot be negative");
  }

  get id()           { return this.props.id; }
  get challengeId()  { return this.props.challengeId; }
  get studentId()    { return this.props.studentId; }
  get progress()     { return this.props.progress; }
  get completedAt()  { return this.props.completedAt; }
  get joinedAt()     { return this.props.joinedAt; }

  isCompleted(): boolean { return !!this.props.completedAt; }

  increment(amount = 1, goal: number): ChallengeParticipation {
    const newProgress = Math.min(this.props.progress + amount, goal);
    const completedAt = newProgress >= goal ? new Date() : this.props.completedAt;
    return new ChallengeParticipation({ ...this.props, progress: newProgress, completedAt });
  }

  percentComplete(goal: number): number { return Math.round((this.props.progress / goal) * 100); }

  toJSON(): ParticipationProps { return { ...this.props }; }
}
