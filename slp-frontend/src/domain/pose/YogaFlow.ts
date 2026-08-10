export interface FlowPose {
  name: string;
  durationSeconds: number;
  side?: "left" | "right" | "both";
  cue: string;
  transitionCue?: string;
}

export type FlowGoal =
  | "morning_energise"
  | "evening_wind_down"
  | "stress_relief"
  | "strength_building"
  | "flexibility"
  | "meditation_flow"
  | "back_pain_relief"
  | "hip_opening"
  | "balance";

export interface YogaFlowProps {
  id: string;
  studentId: string;
  goal: FlowGoal;
  level: "Beginner" | "Intermediate" | "Advanced";
  durationMinutes: number;
  poses: FlowPose[];
  teacherNote: string;
  generatedBy: "ai_ollama" | "teacher" | "admin";
  modelUsed?: string;
  savedByStudent: boolean;
  createdAt: Date;
}

export class YogaFlow {
  constructor(private readonly props: YogaFlowProps) {
    if (props.poses.length === 0) throw new Error("Flow must contain at least one pose");
    if (props.durationMinutes < 5 || props.durationMinutes > 120)
      throw new Error("Flow duration must be 5–120 minutes");
  }

  get id()             { return this.props.id; }
  get studentId()      { return this.props.studentId; }
  get goal()           { return this.props.goal; }
  get level()          { return this.props.level; }
  get durationMinutes(){ return this.props.durationMinutes; }
  get poses()          { return [...this.props.poses]; }
  get teacherNote()    { return this.props.teacherNote; }
  get generatedBy()    { return this.props.generatedBy; }
  get savedByStudent() { return this.props.savedByStudent; }
  get createdAt()      { return this.props.createdAt; }

  actualDurationMinutes(): number {
    return Math.round(this.props.poses.reduce((acc, p) => acc + p.durationSeconds, 0) / 60);
  }

  save(): YogaFlow {
    return new YogaFlow({ ...this.props, savedByStudent: true });
  }

  poseCount(): number { return this.props.poses.length; }

  toJSON(): YogaFlowProps {
    return { ...this.props, poses: this.props.poses.map(p => ({ ...p })) };
  }
}
