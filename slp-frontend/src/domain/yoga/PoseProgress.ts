// Per-asana mastery tracking — custom build; no open-source equivalent
// Tracks a student's progress toward mastering each pose over time

export type MasteryLevel = "novice" | "beginner" | "intermediate" | "advanced" | "master";
export type ImprovementTrend = "improving" | "plateau" | "declining" | "insufficient_data";

export interface PoseAttempt {
  date: Date;
  score: number;           // 0–100 from AI pose detection or teacher rating
  durationSeconds: number;
  source: "ai_detection" | "teacher_rated" | "self_rated";
  note?: string;
}

export interface PoseProgressProps {
  id: string;
  studentId: string;
  asanaId: string;
  asanaName: string;

  masteryLevel: MasteryLevel;
  totalAttempts: number;
  bestScore: number;
  lastScore: number;
  avgScore: number;
  improvementTrend: ImprovementTrend;

  firstAttemptDate?: Date;
  lastAttemptDate?: Date;
  masteryAchievedAt?: Date;

  attempts: PoseAttempt[];       // last 20 attempts kept
  teacherNotes: string;
  isGoalPose: boolean;           // student has flagged this as a goal pose
  isFavorite: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const MAX_STORED_ATTEMPTS = 20;

function computeMastery(avgScore: number): MasteryLevel {
  if (avgScore >= 90) return "master";
  if (avgScore >= 75) return "advanced";
  if (avgScore >= 60) return "intermediate";
  if (avgScore >= 40) return "beginner";
  return "novice";
}

function computeTrend(attempts: PoseAttempt[]): ImprovementTrend {
  if (attempts.length < 5) return "insufficient_data";
  const recent = attempts.slice(-5).map(a => a.score);
  const older = attempts.slice(-10, -5).map(a => a.score);
  if (older.length < 3) return "insufficient_data";
  const recentAvg = recent.reduce((s, x) => s + x, 0) / recent.length;
  const olderAvg = older.reduce((s, x) => s + x, 0) / older.length;
  const delta = recentAvg - olderAvg;
  if (delta > 5) return "improving";
  if (delta < -5) return "declining";
  return "plateau";
}

export class PoseProgress {
  constructor(private props: PoseProgressProps) {
    if (!props.asanaId.trim()) throw new Error("Asana ID required");
    if (props.bestScore < 0 || props.bestScore > 100) throw new Error("Score must be 0–100");
    if (props.totalAttempts < 0) throw new Error("Attempts cannot be negative");
  }

  get id()              { return this.props.id; }
  get studentId()       { return this.props.studentId; }
  get asanaId()         { return this.props.asanaId; }
  get asanaName()       { return this.props.asanaName; }
  get masteryLevel()    { return this.props.masteryLevel; }
  get totalAttempts()   { return this.props.totalAttempts; }
  get bestScore()       { return this.props.bestScore; }
  get lastScore()       { return this.props.lastScore; }
  get avgScore()        { return this.props.avgScore; }
  get improvementTrend(){ return this.props.improvementTrend; }
  get firstAttemptDate(){ return this.props.firstAttemptDate; }
  get lastAttemptDate() { return this.props.lastAttemptDate; }
  get teacherNotes()    { return this.props.teacherNotes; }
  get isGoalPose()      { return this.props.isGoalPose; }
  get isFavorite()      { return this.props.isFavorite; }
  get recentAttempts()  { return this.props.attempts.slice(-5).map(a => ({ ...a })); }

  isMastered(): boolean { return this.props.masteryLevel === "master"; }
  masteryPercent(): number { return this.props.avgScore; }

  recordAttempt(attempt: PoseAttempt): PoseProgress {
    if (attempt.score < 0 || attempt.score > 100) throw new Error("Score must be 0–100");
    const newAttempts = [...this.props.attempts, attempt].slice(-MAX_STORED_ATTEMPTS);
    const totalCount = this.props.totalAttempts + 1;
    const newAvg = Math.round(
      (this.props.avgScore * this.props.totalAttempts + attempt.score) / totalCount
    );
    const newBest = Math.max(this.props.bestScore, attempt.score);
    const newMastery = computeMastery(newAvg);
    const newTrend = computeTrend(newAttempts);

    return new PoseProgress({
      ...this.props,
      totalAttempts: totalCount,
      lastScore: attempt.score,
      bestScore: newBest,
      avgScore: newAvg,
      masteryLevel: newMastery,
      improvementTrend: newTrend,
      attempts: newAttempts,
      firstAttemptDate: this.props.firstAttemptDate ?? attempt.date,
      lastAttemptDate: attempt.date,
      masteryAchievedAt: newMastery === "master" && this.props.masteryLevel !== "master" ? new Date() : this.props.masteryAchievedAt,
      updatedAt: new Date(),
    });
  }

  addTeacherNote(note: string): PoseProgress {
    return new PoseProgress({ ...this.props, teacherNotes: note, updatedAt: new Date() });
  }

  toggleFavorite(): PoseProgress {
    return new PoseProgress({ ...this.props, isFavorite: !this.props.isFavorite, updatedAt: new Date() });
  }

  toJSON(): PoseProgressProps {
    return { ...this.props, attempts: this.props.attempts.map(a => ({ ...a })) };
  }
}

// Static helpers
export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  novice: "Just Starting",
  beginner: "Building Foundation",
  intermediate: "Developing",
  advanced: "Proficient",
  master: "Mastered",
};

export const MASTERY_COLORS: Record<MasteryLevel, string> = {
  novice: "bg-gray-100 text-gray-600",
  beginner: "bg-blue-100 text-blue-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  advanced: "bg-orange-100 text-orange-700",
  master: "bg-green-100 text-green-700",
};
