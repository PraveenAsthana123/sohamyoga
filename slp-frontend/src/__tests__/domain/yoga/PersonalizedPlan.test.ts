import { PersonalizedPlan } from "@/domain/yoga/PersonalizedPlan";

const phase1 = {
  phaseNumber: 1,
  name: "Foundation",
  durationWeeks: 4,
  focusCategory: "standing" as const,
  asanas: [{ asanaId: "tadasana", asanaName: "Tadasana", targetDurationSeconds: 60 }],
  pranayama: ["nadi_shodhana"],
  meditation: true,
  practiceFrequencyPerWeek: 3,
  sessionDurationMinutes: 45,
  teacherNotes: "Focus on alignment",
};

const phase2 = {
  phaseNumber: 2,
  name: "Deepening",
  durationWeeks: 6,
  focusCategory: "balancing" as const,
  asanas: [{ asanaId: "vrksasana", asanaName: "Vrksasana", targetDurationSeconds: 30 }],
  pranayama: ["ujjayi"],
  meditation: true,
  practiceFrequencyPerWeek: 4,
  sessionDurationMinutes: 60,
  teacherNotes: "Balance work",
};

const base = {
  id: "pp1",
  studentId: "s1",
  teacherId: "t1",
  source: "teacher_assigned" as const,
  status: "draft" as const,
  title: "Priya 3-Month Hatha Journey",
  description: "Customized for stress relief and flexibility",
  primaryGoal: "stress_relief" as const,
  secondaryGoals: ["flexibility" as const],
  phases: [phase1, phase2],
  currentPhaseIndex: 0,
  totalSessionsCompleted: 0,
  totalMinutesPracticed: 0,
  isPublicTemplate: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PersonalizedPlan", () => {
  it("creates valid plan", () => {
    const p = new PersonalizedPlan(base);
    expect(p.title).toBe("Priya 3-Month Hatha Journey");
    expect(p.phases).toHaveLength(2);
  });

  it("throws on empty title", () => {
    expect(() => new PersonalizedPlan({ ...base, title: "" })).toThrow("Plan title required");
  });

  it("throws when no phases", () => {
    expect(() => new PersonalizedPlan({ ...base, phases: [] })).toThrow("Plan must have at least one phase");
  });

  it("throws on invalid phase index", () => {
    expect(() => new PersonalizedPlan({ ...base, currentPhaseIndex: 5 })).toThrow("Current phase index out of bounds");
  });

  it("throws on zero-week phase", () => {
    expect(() => new PersonalizedPlan({ ...base, phases: [{ ...phase1, durationWeeks: 0 }] })).toThrow("All phases must have positive duration");
  });

  it("throws on invalid frequency", () => {
    expect(() => new PersonalizedPlan({ ...base, phases: [{ ...phase1, practiceFrequencyPerWeek: 0 }] })).toThrow("Practice frequency must be 1–7");
  });

  it("currentPhase — returns correct phase", () => {
    expect(new PersonalizedPlan(base).currentPhase().name).toBe("Foundation");
  });

  it("totalDurationWeeks — sums all phases", () => {
    expect(new PersonalizedPlan(base).totalDurationWeeks()).toBe(10); // 4+6
  });

  it("totalPlannedSessions — correct calculation", () => {
    // phase1: 4 weeks * 3/week = 12; phase2: 6*4=24 → 36
    expect(new PersonalizedPlan(base).totalPlannedSessions()).toBe(36);
  });

  it("progressPercent — 0 when no sessions done", () => {
    expect(new PersonalizedPlan(base).progressPercent()).toBe(0);
  });

  it("progressPercent — updates after sessions", () => {
    const p = new PersonalizedPlan(base).activate().recordSession(45).recordSession(45);
    expect(p.progressPercent()).toBeGreaterThan(0);
  });

  it("activate — draft → active", () => {
    const p = new PersonalizedPlan(base).activate();
    expect(p.status).toBe("active");
    expect(p.startedAt).toBeDefined();
  });

  it("activate — throws if not draft", () => {
    expect(() => new PersonalizedPlan({ ...base, status: "active" }).activate()).toThrow("Only draft plans can be activated");
  });

  it("pause — active → paused", () => {
    const p = new PersonalizedPlan({ ...base, status: "active" }).pause();
    expect(p.status).toBe("paused");
  });

  it("resume — paused → active", () => {
    const p = new PersonalizedPlan({ ...base, status: "paused" }).resume();
    expect(p.status).toBe("active");
  });

  it("complete — sets completed state", () => {
    const p = new PersonalizedPlan({ ...base, status: "active" }).complete();
    expect(p.status).toBe("completed");
    expect(p.completedAt).toBeDefined();
  });

  it("advancePhase — moves to next phase", () => {
    const p = new PersonalizedPlan(base).advancePhase();
    expect(p.currentPhaseIndex).toBe(1);
    expect(p.currentPhase().name).toBe("Deepening");
  });

  it("advancePhase — throws on final phase", () => {
    const p = new PersonalizedPlan({ ...base, currentPhaseIndex: 1 });
    expect(() => p.advancePhase()).toThrow("Already on final phase");
  });

  it("recordSession — accumulates time", () => {
    const p = new PersonalizedPlan(base).activate().recordSession(45).recordSession(60);
    expect(p.totalMinutesPracticed).toBe(105);
    expect(p.totalSessionsCompleted).toBe(2);
  });

  it("recordSession — throws on < 1 minute", () => {
    expect(() => new PersonalizedPlan(base).recordSession(0)).toThrow("Duration must be at least 1 minute");
  });

  it("rate — stores rating and feedback", () => {
    const p = new PersonalizedPlan(base).rate(5, "Life-changing!");
    expect(p.overallRating).toBe(5);
  });

  it("immutable — activate does not modify original", () => {
    const p = new PersonalizedPlan(base);
    p.activate();
    expect(p.status).toBe("draft");
  });
});
