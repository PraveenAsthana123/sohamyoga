export interface PoseFeedback {
  corrections: string[];   // what needs fixing
  tip: string;             // positive coaching cue
  bodyParts: string[];     // which body parts are out of alignment
}

export interface PoseSessionProps {
  id: string;
  studentId: string;
  poseName: string;
  imageBase64?: string;    // not persisted long-term — used for AI call only
  score: number;           // 0–100
  feedback: PoseFeedback;
  modelUsed: string;       // e.g. "mediapipe_v2 + ollama:qwen2.5-coder:3b"
  durationSeconds: number;
  sessionDate: Date;
}

export class PoseSession {
  constructor(private readonly props: PoseSessionProps) {
    if (props.score < 0 || props.score > 100) throw new Error("Score must be 0–100");
    if (!props.poseName.trim()) throw new Error("Pose name is required");
    if (props.durationSeconds < 1) throw new Error("Duration must be at least 1 second");
  }

  get id()              { return this.props.id; }
  get studentId()       { return this.props.studentId; }
  get poseName()        { return this.props.poseName; }
  get score()           { return this.props.score; }
  get feedback()        { return { ...this.props.feedback, corrections: [...this.props.feedback.corrections] }; }
  get modelUsed()       { return this.props.modelUsed; }
  get durationSeconds() { return this.props.durationSeconds; }
  get sessionDate()     { return this.props.sessionDate; }

  grade(): "excellent" | "good" | "needs_work" | "poor" {
    if (this.props.score >= 90) return "excellent";
    if (this.props.score >= 75) return "good";
    if (this.props.score >= 55) return "needs_work";
    return "poor";
  }

  hasCorrections(): boolean { return this.props.feedback.corrections.length > 0; }

  toJSON(): Omit<PoseSessionProps, "imageBase64"> {
    const { imageBase64: _, ...rest } = this.props;
    return { ...rest, feedback: { ...rest.feedback, corrections: [...rest.feedback.corrections] } };
  }
}
