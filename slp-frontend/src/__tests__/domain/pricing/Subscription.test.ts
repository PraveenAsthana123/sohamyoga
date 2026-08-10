import { Subscription, SubscriptionProps } from "@/domain/pricing/Subscription";

// Future dates so "active" subscription isn't expired during tests
const START   = new Date("2026-08-05T00:00:00Z");
const EXPIRES = new Date("2026-09-05T00:00:00Z"); // 31 days later

const base: SubscriptionProps = {
  id: "sub1",
  customerId: "cust_01",
  planId: "plan_gold",
  planName: "Gold Monthly",
  planType: "gold",
  status: "active",
  billingCycle: "monthly",
  billingAmount: 149,
  currency: "CAD",
  billingCycleDays: 31,
  startedAt: START,
  expiresAt: EXPIRES,
  autoRenew: true,
  familySeats: [],
  prorationCredit: 0,
  notes: "",
  createdAt: START,
  updatedAt: START,
};

describe("Subscription", () => {
  // --- Construction & validation ---
  it("creates valid subscription", () => {
    const s = new Subscription(base);
    expect(s.planName).toBe("Gold Monthly");
    expect(s.status).toBe("active");
    expect(s.autoRenew).toBe(true);
  });

  it("throws on blank customerId", () => {
    expect(() => new Subscription({ ...base, customerId: " " })).toThrow("Customer ID required");
  });

  it("throws on blank planId", () => {
    expect(() => new Subscription({ ...base, planId: "" })).toThrow("Plan ID required");
  });

  it("throws on negative billingAmount", () => {
    expect(() => new Subscription({ ...base, billingAmount: -1 })).toThrow("Billing amount cannot be negative");
  });

  it("throws when billingCycleDays < 1", () => {
    expect(() => new Subscription({ ...base, billingCycleDays: 0 })).toThrow("Billing cycle days must be >= 1");
  });

  it("throws when expiresAt <= startedAt", () => {
    expect(() => new Subscription({ ...base, expiresAt: START })).toThrow("expiresAt must be after startedAt");
  });

  it("throws on negative prorationCredit", () => {
    expect(() => new Subscription({ ...base, prorationCredit: -5 })).toThrow("Proration credit cannot be negative");
  });

  // --- daysRemaining ---
  it("daysRemaining — counts days until expiry", () => {
    // From START to EXPIRES is 31 days
    const days = new Subscription(base).daysRemaining(START);
    expect(days).toBe(31);
  });

  it("daysRemaining — 0 when expired", () => {
    const past = new Subscription({ ...base, expiresAt: new Date("2026-08-06T00:00:00Z") });
    expect(past.daysRemaining(new Date("2026-09-01T00:00:00Z"))).toBe(0);
  });

  // --- calculateProratedCredit ---
  it("calculateProratedCredit — proportional to remaining days", () => {
    // 31 days remaining out of 31, billing CAD 149
    const s = new Subscription(base);
    const credit = s.calculateProratedCredit(START);
    expect(credit).toBe(149); // 31/31 * 149
  });

  it("calculateProratedCredit — half remaining = half credit", () => {
    const halfwayThrough = new Date("2026-08-20T12:00:00Z"); // ~15 days in
    const s = new Subscription(base);
    const credit = s.calculateProratedCredit(halfwayThrough);
    expect(credit).toBeGreaterThan(0);
    expect(credit).toBeLessThan(149);
  });

  it("calculateProratedCredit — 0 when expired", () => {
    const old = new Subscription({ ...base, expiresAt: new Date("2026-08-06T00:00:00Z") });
    expect(old.calculateProratedCredit(new Date("2026-09-01T00:00:00Z"))).toBe(0);
  });

  // --- pause / resume ---
  it("pause — active → paused with reason", () => {
    const s = new Subscription(base).pause("Vacation", new Date("2026-08-10T00:00:00Z"));
    expect(s.status).toBe("paused");
    expect(s.pauseReason).toBe("Vacation");
    expect(s.pausedAt).toBeDefined();
  });

  it("pause — throws when not active", () => {
    const s: SubscriptionProps = { ...base, status: "paused", pausedAt: new Date(), pauseReason: "x" };
    expect(() => new Subscription(s).pause("again")).toThrow("Can only pause an active subscription");
  });

  it("pause — throws with blank reason", () => {
    expect(() => new Subscription(base).pause("  ")).toThrow("Pause reason required");
  });

  it("resume — paused → active with extended expiresAt", () => {
    const pauseAt  = new Date("2026-08-10T00:00:00Z");
    const resumeAt = new Date("2026-08-17T00:00:00Z"); // 7 days later
    const paused = new Subscription(base).pause("Holiday", pauseAt);
    const resumed = paused.resume(resumeAt);
    expect(resumed.status).toBe("active");
    // expiresAt should be extended by 7 days
    const extendedBy = resumed.expiresAt.getTime() - EXPIRES.getTime();
    expect(extendedBy).toBe(7 * 86400000);
  });

  it("resume — throws when not paused", () => {
    expect(() => new Subscription(base).resume()).toThrow("Can only resume a paused subscription");
  });

  // --- freeze / unfreeze ---
  it("freeze — active → frozen with extended expiresAt", () => {
    const from = new Date("2026-08-20T00:00:00Z");
    const to   = new Date("2026-08-30T00:00:00Z"); // 10 days
    const s = new Subscription(base).freeze(from, to);
    expect(s.status).toBe("frozen");
    expect(s.frozenFrom?.toISOString()).toBe(from.toISOString());
    const extendedBy = s.expiresAt.getTime() - EXPIRES.getTime();
    expect(extendedBy).toBe(10 * 86400000);
  });

  it("freeze — throws when to <= from", () => {
    const d = new Date("2026-08-20T00:00:00Z");
    expect(() => new Subscription(base).freeze(d, d)).toThrow("Freeze end must be after freeze start");
  });

  it("freeze — throws when not active", () => {
    const s: SubscriptionProps = { ...base, status: "paused", pausedAt: new Date(), pauseReason: "x" };
    expect(() => new Subscription(s).freeze(new Date("2026-08-20T00:00:00Z"), new Date("2026-08-30T00:00:00Z"))).toThrow("Can only freeze an active subscription");
  });

  it("unfreeze — frozen → active", () => {
    const from = new Date("2026-08-20T00:00:00Z");
    const to   = new Date("2026-08-25T00:00:00Z");
    const s = new Subscription(base).freeze(from, to).unfreeze();
    expect(s.status).toBe("active");
    expect(s.frozenFrom).toBeUndefined();
  });

  it("unfreeze — throws when not frozen", () => {
    expect(() => new Subscription(base).unfreeze()).toThrow("Can only unfreeze a frozen subscription");
  });

  // --- grace period ---
  it("enterGracePeriod — sets gracePeriodEndsAt", () => {
    const s = new Subscription(base).enterGracePeriod(7);
    expect(s.status).toBe("grace_period");
    expect(s.gracePeriodEndsAt).toBeDefined();
  });

  it("enterGracePeriod — throws when days < 1", () => {
    expect(() => new Subscription(base).enterGracePeriod(0)).toThrow("Grace period must be at least 1 day");
  });

  it("isInGracePeriod — true during grace", () => {
    const s = new Subscription(base).enterGracePeriod(30);
    expect(s.isInGracePeriod()).toBe(true);
  });

  it("isInGracePeriod — false when not in grace_period status", () => {
    expect(new Subscription(base).isInGracePeriod()).toBe(false);
  });

  // --- cancel ---
  it("cancel — any → cancelled", () => {
    const s = new Subscription(base).cancel("Customer request");
    expect(s.status).toBe("cancelled");
    expect(s.cancelReason).toBe("Customer request");
    expect(s.cancelledAt).toBeDefined();
  });

  it("cancel — throws with blank reason", () => {
    expect(() => new Subscription(base).cancel("  ")).toThrow("Cancellation reason required");
  });

  it("cancel — throws if already cancelled", () => {
    const s: SubscriptionProps = { ...base, status: "cancelled", cancelReason: "x", cancelledAt: new Date() };
    expect(() => new Subscription(s).cancel("again")).toThrow("Already cancelled");
  });

  it("cancelWithCredit — stores prorationCredit", () => {
    const s = new Subscription(base).cancelWithCredit("Upgraded to Platinum", 45.50);
    expect(s.prorationCredit).toBe(45.50);
    expect(s.status).toBe("cancelled");
  });

  // --- downgrade scheduling ---
  it("scheduleDowngrade — sets pendingDowngradePlanId", () => {
    const s = new Subscription(base).scheduleDowngrade("plan_silver");
    expect(s.pendingDowngradePlanId).toBe("plan_silver");
  });

  it("scheduleDowngrade — throws with blank planId", () => {
    expect(() => new Subscription(base).scheduleDowngrade("  ")).toThrow("Plan ID required");
  });

  it("scheduleDowngrade — throws from cancelled status", () => {
    const s: SubscriptionProps = { ...base, status: "cancelled", cancelReason: "x", cancelledAt: new Date() };
    expect(() => new Subscription(s).scheduleDowngrade("plan_silver")).toThrow("Can only schedule downgrade for active or paused subscriptions");
  });

  // --- autoRenew ---
  it("setAutoRenew — disables auto renew", () => {
    expect(new Subscription(base).setAutoRenew(false).autoRenew).toBe(false);
  });

  // --- Family seats ---
  it("addFamilySeat — adds seat", () => {
    const s = new Subscription(base).addFamilySeat("cust_02", "Jane Doe", 4);
    expect(s.activeFamilySeatCount()).toBe(1);
    expect(s.hasActiveFamilySeat("cust_02")).toBe(true);
  });

  it("addFamilySeat — throws at capacity", () => {
    const s = new Subscription(base)
      .addFamilySeat("c1", "A", 2)
      .addFamilySeat("c2", "B", 2);
    expect(() => s.addFamilySeat("c3", "C", 2)).toThrow("Family seat limit (2) reached");
  });

  it("addFamilySeat — throws if duplicate", () => {
    const s = new Subscription(base).addFamilySeat("c1", "A", 4);
    expect(() => s.addFamilySeat("c1", "A again", 4)).toThrow("Customer already has a family seat");
  });

  it("removeFamilySeat — marks seat removed", () => {
    const s = new Subscription(base).addFamilySeat("c1", "A", 4).removeFamilySeat("c1");
    expect(s.hasActiveFamilySeat("c1")).toBe(false);
    expect(s.activeFamilySeatCount()).toBe(0);
  });

  it("removeFamilySeat — throws when seat not found", () => {
    expect(() => new Subscription(base).removeFamilySeat("nonexistent")).toThrow("Active family seat not found");
  });

  // --- Immutability ---
  it("immutable — pause does not modify original", () => {
    const s = new Subscription(base);
    s.pause("test");
    expect(s.status).toBe("active");
  });
});
