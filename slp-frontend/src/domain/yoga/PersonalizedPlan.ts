// Personalized yoga plan — custom build; no open-source equivalent
// Teacher or AI assigns a multi-phase practice roadmap to a student

import type { YogaGoal } from "@/domain/wellness/WellnessProfile";
import type { YogaCategory } from "./Asana";

export type PlanStatus = "draft" | "active" | "paused" | "completed" | "archived";
export type PlanSource = "teacher_assigned" | "ai_generated" | "self_selected";

export interface PlanAsana {
  asanaId: string;
  asanaName: string;
  targetDurationSeconds: number;
  targetReps?: number;
  side?: "left" | "right" | "both";
  notes?: string;
}

export interface PlanPhase {
  phaseNumber: number;
  name: string;                   // "Foundation", "Deepening", "Mastery"
  durationWeeks: number;
  focusCategory: YogaCategory;
  asanas: PlanAsana[];
  pranayama: string[];            // pranayama IDs
  meditation: boolean;
  practiceFrequencyPerWeek: number;
  sessionDurationMinutes: number;
  teacherNotes: string;
  completedAt?: Date;
}

export interface PersonalizedPlanProps {
  id: string;
  studentId: string;
  teacherId?: string;
  source: PlanSource;
  status: PlanStatus;

  title: string;
  description: string;
  primaryGoal: YogaGoal;
  secondaryGoals: YogaGoal[];

  phases: PlanPhase[];
  currentPhaseIndex: number;

  startedAt?: Date;
  targetCompletionDate?: Date;
  completedAt?: Date;

  // AI generation context
  aiModelUsed?: string;
  aiPromptSummary?: string;

  // Progress tracking
  totalSessionsCompleted: number;
  totalMinutesPracticed: number;
  lastPracticedAt?: Date;
  studentFeedback?: string;
  teacherReview?: string;
  overallRating?: 1 | 2 | 3 | 4 | 5;

  isPublicTemplate: boolean;      // teacher can share as template
  createdAt: Date;
  updatedAt: Date;
}

export class PersonalizedPlan {
  constructor(private props: PersonalizedPlanProps) {
    if (!props.title.trim()) throw new Error("Plan title required");
    if (props.phases.length === 0) throw new Error("Plan must have at least one phase");
    if (props.currentPhaseIndex < 0 || props.currentPhaseIndex >= props.phases.length)
      throw new Error("Current phase index out of bounds");
    if (props.phases.some(p => p.durationWeeks <= 0))
      throw new Error("All phases must have positive duration");
    if (props.phases.some(p => p.practiceFrequencyPerWeek < 1 || p.practiceFrequencyPerWeek > 7))
      throw new Error("Practice frequency must be 1–7 days per week");
  }

  get id()                    { return this.props.id; }
  get studentId()             { return this.props.studentId; }
  get teacherId()             { return this.props.teacherId; }
  get status()                { return this.props.status; }
  get title()                 { return this.props.title; }
  get primaryGoal()           { return this.props.primaryGoal; }
  get phases()                { return this.props.phases.map(p => ({ ...p, asanas: p.asanas.map(a => ({ ...a })), pranayama: [...p.pranayama] })); }
  get currentPhaseIndex()     { return this.props.currentPhaseIndex; }
  get totalSessionsCompleted(){ return this.props.totalSessionsCompleted; }
  get totalMinutesPracticed() { return this.props.totalMinutesPracticed; }
  get overallRating()         { return this.props.overallRating; }
  get isPublicTemplate()      { return this.props.isPublicTemplate; }
  get source()                { return this.props.source; }
  get startedAt()             { return this.props.startedAt; }
  get completedAt()           { return this.props.completedAt; }

  currentPhase(): PlanPhase {
    return this.props.phases[this.props.currentPhaseIndex];
  }

  totalDurationWeeks(): number {
    return this.props.phases.reduce((sum, p) => sum + p.durationWeeks, 0);
  }

  totalPlannedSessions(): number {
    return this.props.phases.reduce((sum, p) => sum + p.durationWeeks * p.practiceFrequencyPerWeek, 0);
  }

  progressPercent(): number {
    const total = this.totalPlannedSessions();
    if (total === 0) return 0;
    return Math.min(100, Math.round((this.props.totalSessionsCompleted / total) * 100));
  }

  activate(): PersonalizedPlan {
    if (this.props.status !== "draft") throw new Error("Only draft plans can be activated");
    return new PersonalizedPlan({ ...this.props, status: "active", startedAt: new Date(), updatedAt: new Date() });
  }

  pause(): PersonalizedPlan {
    if (this.props.status !== "active") throw new Error("Only active plans can be paused");
    return new PersonalizedPlan({ ...this.props, status: "paused", updatedAt: new Date() });
  }

  resume(): PersonalizedPlan {
    if (this.props.status !== "paused") throw new Error("Only paused plans can be resumed");
    return new PersonalizedPlan({ ...this.props, status: "active", updatedAt: new Date() });
  }

  complete(): PersonalizedPlan {
    if (!["active","paused"].includes(this.props.status)) throw new Error("Cannot complete in current state");
    return new PersonalizedPlan({ ...this.props, status: "completed", completedAt: new Date(), updatedAt: new Date() });
  }

  advancePhase(): PersonalizedPlan {
    if (this.props.currentPhaseIndex >= this.props.phases.length - 1)
      throw new Error("Already on final phase");
    const updatedPhases = this.props.phases.map((p, i) =>
      i === this.props.currentPhaseIndex ? { ...p, completedAt: new Date() } : p
    );
    return new PersonalizedPlan({ ...this.props, phases: updatedPhases, currentPhaseIndex: this.props.currentPhaseIndex + 1, updatedAt: new Date() });
  }

  recordSession(durationMinutes: number): PersonalizedPlan {
    if (durationMinutes < 1) throw new Error("Duration must be at least 1 minute");
    return new PersonalizedPlan({
      ...this.props,
      totalSessionsCompleted: this.props.totalSessionsCompleted + 1,
      totalMinutesPracticed: this.props.totalMinutesPracticed + durationMinutes,
      lastPracticedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  rate(rating: 1 | 2 | 3 | 4 | 5, feedback?: string): PersonalizedPlan {
    return new PersonalizedPlan({ ...this.props, overallRating: rating, studentFeedback: feedback, updatedAt: new Date() });
  }

  toJSON(): PersonalizedPlanProps {
    return {
      ...this.props,
      phases: this.phases,
      secondaryGoals: [...this.props.secondaryGoals],
    };
  }
}
