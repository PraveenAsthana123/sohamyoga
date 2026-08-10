import { Challenge, ChallengeParticipation } from "@/domain/community/Challenge";

const baseChal = {
  id: "chal_1",
  createdById: "admin_1",
  title: "7-Day Morning Flow",
  description: "Complete a morning flow every day for 7 days.",
  type: "streak" as const,
  goal: 7,
  rewardLabel: "🏅 Sunrise Warrior",
  startDate: new Date(Date.now() - 86400000),  // yesterday
  endDate: new Date(Date.now() + 6 * 86400000), // 6 days from now
  isActive: true,
};

const baseParticipation = {
  id: "part_1",
  challengeId: "chal_1",
  studentId: "student_1",
  progress: 0,
  joinedAt: new Date(),
};

describe("Challenge", () => {
  it("creates a valid challenge", () => {
    const c = new Challenge(baseChal);
    expect(c.title).toBe("7-Day Morning Flow");
    expect(c.isLive()).toBe(true);
  });

  it("throws when end is before start", () => {
    expect(() => new Challenge({ ...baseChal, endDate: new Date(Date.now() - 86400000 * 2) })).toThrow("End date must be after start date");
  });

  it("throws when goal < 1", () => {
    expect(() => new Challenge({ ...baseChal, goal: 0 })).toThrow("Goal must be >= 1");
  });

  it("throws when title is blank", () => {
    expect(() => new Challenge({ ...baseChal, title: "" })).toThrow("Title is required");
  });

  it("calculates days remaining", () => {
    const c = new Challenge(baseChal);
    expect(c.daysRemaining()).toBeGreaterThan(5);
  });

  it("inactive challenge is not live", () => {
    const c = new Challenge({ ...baseChal, isActive: false });
    expect(c.isLive()).toBe(false);
  });
});

describe("ChallengeParticipation", () => {
  it("creates with zero progress", () => {
    const p = new ChallengeParticipation(baseParticipation);
    expect(p.progress).toBe(0);
    expect(p.isCompleted()).toBe(false);
  });

  it("increments progress", () => {
    const p = new ChallengeParticipation(baseParticipation).increment(3, 7);
    expect(p.progress).toBe(3);
    expect(p.percentComplete(7)).toBe(43);
  });

  it("completes when goal reached", () => {
    const p = new ChallengeParticipation(baseParticipation).increment(7, 7);
    expect(p.isCompleted()).toBe(true);
    expect(p.completedAt).toBeDefined();
  });

  it("caps progress at goal", () => {
    const p = new ChallengeParticipation(baseParticipation).increment(10, 7);
    expect(p.progress).toBe(7);
  });

  it("throws on negative progress", () => {
    expect(() => new ChallengeParticipation({ ...baseParticipation, progress: -1 })).toThrow("Progress cannot be negative");
  });
});
