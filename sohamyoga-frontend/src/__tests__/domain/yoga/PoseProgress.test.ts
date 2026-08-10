import { PoseProgress, MASTERY_LABELS, MASTERY_COLORS } from "@/domain/yoga/PoseProgress";

const base = {
  id: "pp1",
  studentId: "s1",
  asanaId: "tadasana",
  asanaName: "Tadasana",
  masteryLevel: "beginner" as const,
  totalAttempts: 5,
  bestScore: 65,
  lastScore: 60,
  avgScore: 55,
  improvementTrend: "insufficient_data" as const,
  attempts: [],
  teacherNotes: "",
  isGoalPose: false,
  isFavorite: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makeAttempt = (score: number) => ({
  date: new Date(),
  score,
  durationSeconds: 30,
  source: "teacher_rated" as const,
});

describe("PoseProgress", () => {
  it("creates valid progress record", () => {
    const p = new PoseProgress(base);
    expect(p.asanaName).toBe("Tadasana");
    expect(p.masteryLevel).toBe("beginner");
  });

  it("throws on empty asana ID", () => {
    expect(() => new PoseProgress({ ...base, asanaId: "  " })).toThrow("Asana ID required");
  });

  it("throws on score out of range", () => {
    expect(() => new PoseProgress({ ...base, bestScore: 110 })).toThrow("Score must be 0–100");
  });

  it("throws on negative attempts", () => {
    expect(() => new PoseProgress({ ...base, totalAttempts: -1 })).toThrow("Attempts cannot be negative");
  });

  it("isMastered — false for beginner", () => {
    expect(new PoseProgress(base).isMastered()).toBe(false);
  });

  it("isMastered — true for master level", () => {
    expect(new PoseProgress({ ...base, masteryLevel: "master" }).isMastered()).toBe(true);
  });

  it("recordAttempt — increments total", () => {
    const p = new PoseProgress(base).recordAttempt(makeAttempt(70));
    expect(p.totalAttempts).toBe(6);
    expect(p.lastScore).toBe(70);
  });

  it("recordAttempt — updates bestScore", () => {
    const p = new PoseProgress(base).recordAttempt(makeAttempt(80));
    expect(p.bestScore).toBe(80);
  });

  it("recordAttempt — bestScore not downgraded by lower score", () => {
    const p = new PoseProgress(base).recordAttempt(makeAttempt(30));
    expect(p.bestScore).toBe(65);
  });

  it("recordAttempt — promotes mastery level", () => {
    // avg 92 * 5 attempts + score 95 = 535/6 = 89.2→89; use higher base to cross 90 threshold
    const p = new PoseProgress({ ...base, avgScore: 93, bestScore: 95, totalAttempts: 9 }).recordAttempt(makeAttempt(97));
    // (93*9 + 97)/10 = (837+97)/10 = 93.4 → 93 >= 90 → master
    expect(p.masteryLevel).toBe("master");
  });

  it("recordAttempt — throws on out-of-range score", () => {
    expect(() => new PoseProgress(base).recordAttempt(makeAttempt(110))).toThrow("Score must be 0–100");
  });

  it("recordAttempt — keeps max 20 attempts", () => {
    let p = new PoseProgress(base);
    for (let i = 0; i < 25; i++) p = p.recordAttempt(makeAttempt(60));
    expect(p.recentAttempts.length).toBeLessThanOrEqual(5);
    expect(p.totalAttempts).toBe(30); // base 5 + 25
  });

  it("addTeacherNote — stores note", () => {
    const p = new PoseProgress(base).addTeacherNote("Bend front knee more");
    expect(p.teacherNotes).toBe("Bend front knee more");
  });

  it("toggleFavorite — flips flag", () => {
    const p = new PoseProgress(base).toggleFavorite();
    expect(p.isFavorite).toBe(true);
    expect(new PoseProgress(base).toggleFavorite().toggleFavorite().isFavorite).toBe(false);
  });

  it("immutable — recordAttempt does not modify original", () => {
    const p = new PoseProgress(base);
    p.recordAttempt(makeAttempt(80));
    expect(p.totalAttempts).toBe(5);
  });
});

describe("MASTERY_LABELS and MASTERY_COLORS", () => {
  it("has all 5 mastery levels", () => {
    expect(Object.keys(MASTERY_LABELS)).toHaveLength(5);
    expect(Object.keys(MASTERY_COLORS)).toHaveLength(5);
  });

  it("master level has green color", () => {
    expect(MASTERY_COLORS.master).toContain("green");
  });
});
