import { Streak, PointsLedger, SEED_BADGES } from "@/domain/gamification/Achievement";

// ---- Streak tests ----
describe("Streak", () => {
  const yesterday = new Date(Date.now() - 86400000);
  const twoDaysAgo = new Date(Date.now() - 86400000 * 2);
  const threeDaysAgo = new Date(Date.now() - 86400000 * 3);

  const base = {
    userId: "u1",
    type: "daily_practice" as const,
    currentStreak: 5,
    longestStreak: 10,
    lastActivityDate: yesterday,
    freezesRemaining: 1,
    updatedAt: new Date(),
  };

  it("creates valid streak", () => {
    const s = new Streak(base);
    expect(s.currentStreak).toBe(5);
    expect(s.longestStreak).toBe(10);
  });

  it("throws on negative streak", () => {
    expect(() => new Streak({ ...base, currentStreak: -1 })).toThrow("Streak cannot be negative");
  });

  it("throws on negative freezes", () => {
    expect(() => new Streak({ ...base, freezesRemaining: -1 })).toThrow("Freezes cannot be negative");
  });

  it("record — increments streak on consecutive day", () => {
    const today = new Date();
    const s = new Streak(base).record(today);
    expect(s.currentStreak).toBe(6);
  });

  it("record — ignores duplicate same-day record", () => {
    // base has lastActivity = yesterday, if we record yesterday again = daysSince 0 → same
    const s = new Streak(base).record(yesterday);
    expect(s.currentStreak).toBe(5);
  });

  it("record — updates longestStreak if new record", () => {
    const s = new Streak({ ...base, currentStreak: 10, longestStreak: 10 });
    const today = new Date();
    const s2 = s.record(today);
    expect(s2.longestStreak).toBe(11);
  });

  it("record — uses freeze when missed 2 days", () => {
    const s = new Streak({ ...base, lastActivityDate: twoDaysAgo, freezesRemaining: 1 });
    const today = new Date();
    const s2 = s.record(today);
    expect(s2.currentStreak).toBe(6);
    expect(s2.freezesRemaining).toBe(0);
  });

  it("record — breaks streak when missed 2 days and no freezes", () => {
    const s = new Streak({ ...base, lastActivityDate: twoDaysAgo, freezesRemaining: 0 });
    const today = new Date();
    const s2 = s.record(today);
    expect(s2.currentStreak).toBe(1);
  });

  it("record — breaks streak when missed 3 days", () => {
    const s = new Streak({ ...base, lastActivityDate: threeDaysAgo });
    const today = new Date();
    const s2 = s.record(today);
    expect(s2.currentStreak).toBe(1);
  });

  it("addFreeze — increments freeze count", () => {
    const s = new Streak(base).addFreeze();
    expect(s.freezesRemaining).toBe(2);
  });

  it("isAtRisk — true when day missed and no freezes", () => {
    const s = new Streak({ ...base, freezesRemaining: 0 });
    expect(s.isAtRisk()).toBe(true);
  });

  it("isAtRisk — false when freeze available", () => {
    const s = new Streak({ ...base, freezesRemaining: 1 });
    expect(s.isAtRisk()).toBe(false);
  });
});

// ---- PointsLedger tests ----
describe("PointsLedger", () => {
  const base = {
    id: "pl1",
    userId: "u1",
    points: 100,
    totalEarned: 100,
    totalSpent: 0,
    level: 1,
    xp: 200,
    xpToNextLevel: 500,
  };

  it("creates valid ledger", () => {
    const l = new PointsLedger(base);
    expect(l.points).toBe(100);
    expect(l.level).toBe(1);
  });

  it("throws on negative balance", () => {
    expect(() => new PointsLedger({ ...base, points: -1 })).toThrow("Points balance cannot be negative");
  });

  it("earn — adds points and xp", () => {
    const l = new PointsLedger(base).earn(50, 100);
    expect(l.points).toBe(150);
    expect(l.xp).toBe(300);
  });

  it("earn — levels up when xp exceeds threshold", () => {
    const l = new PointsLedger(base).earn(0, 350); // 200+350=550, level up
    expect(l.level).toBe(2);
    expect(l.xp).toBe(50); // 550 % 500
  });

  it("earn — throws on negative amount", () => {
    expect(() => new PointsLedger(base).earn(-1, 0)).toThrow("Earned amount must be >= 0");
  });

  it("spend — deducts points", () => {
    const l = new PointsLedger(base).spend(40);
    expect(l.points).toBe(60);
    expect(l.totalSpent).toBe(40);
  });

  it("spend — throws on insufficient points", () => {
    expect(() => new PointsLedger(base).spend(200)).toThrow("Insufficient points");
  });

  it("xpPercent — correct percentage", () => {
    expect(new PointsLedger(base).xpPercent()).toBe(40); // 200/500
  });
});

// ---- Badge seed tests ----
describe("SEED_BADGES", () => {
  it("has 10 badges", () => {
    expect(SEED_BADGES).toHaveLength(10);
  });

  it("all badges have unique IDs", () => {
    const ids = SEED_BADGES.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all badges have non-empty emoji", () => {
    SEED_BADGES.forEach(b => expect(b.emoji.length).toBeGreaterThan(0));
  });

  it("secret badges exist for milestone poses", () => {
    const secret = SEED_BADGES.filter(b => b.isSecret);
    expect(secret.length).toBeGreaterThan(0);
  });
});
