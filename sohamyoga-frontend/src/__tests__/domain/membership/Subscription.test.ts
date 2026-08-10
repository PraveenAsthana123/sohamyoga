import { Subscription } from "@/domain/membership/Subscription";

const makeProps = (overrides = {}) => ({
  id: "sub_1",
  memberId: "member_1",
  planId: "plan_monthly",
  status: "ACTIVE" as const,
  currentPeriodStart: new Date("2026-08-01"),
  currentPeriodEnd: new Date("2026-09-01"),
  trialEnd: undefined,
  ...overrides,
});

describe("Subscription", () => {
  it("creates subscription with SubscriptionStarted event", () => {
    const s = Subscription.create(makeProps());
    expect(s.status).toBe("ACTIVE");
    expect(s.domainEvents[0].type).toBe("SubscriptionStarted");
  });

  it("isActive returns true for ACTIVE and TRIALING", () => {
    const active = new Subscription(makeProps());
    const trialing = new Subscription(makeProps({ status: "TRIALING" }));
    expect(active.isActive()).toBe(true);
    expect(trialing.isActive()).toBe(true);
  });

  it("isActive returns false for CANCELLED", () => {
    const cancelled = new Subscription(makeProps({ status: "CANCELLED" }));
    expect(cancelled.isActive()).toBe(false);
  });

  it("cancels at end of period", () => {
    const s = Subscription.create(makeProps());
    const cancelled = s.cancelAtEndOfPeriod();
    expect(cancelled.cancelAtPeriodEnd).toBe(true);
    expect(cancelled.isActive()).toBe(true); // still active until period ends
    expect(cancelled.domainEvents.some(e => e.type === "SubscriptionCancelled")).toBe(true);
  });

  it("cancels immediately", () => {
    const s = Subscription.create(makeProps());
    const cancelled = s.cancelImmediately();
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.isActive()).toBe(false);
  });

  it("throws when cancelling inactive subscription", () => {
    const s = new Subscription(makeProps({ status: "CANCELLED" }));
    expect(() => s.cancelAtEndOfPeriod()).toThrow("Cannot cancel an inactive subscription");
  });

  it("pauses an active subscription", () => {
    const s = Subscription.create(makeProps());
    const pauseUntil = new Date(Date.now() + 7 * 86400000);
    const paused = s.pause(pauseUntil);
    expect(paused.status).toBe("PAUSED");
    expect(paused.domainEvents.some(e => e.type === "SubscriptionPaused")).toBe(true);
  });

  it("throws when pausing with past date", () => {
    const s = Subscription.create(makeProps());
    const pastDate = new Date("2020-01-01");
    expect(() => s.pause(pastDate)).toThrow("Pause end date must be in the future");
  });

  it("resumes a paused subscription", () => {
    const s = Subscription.create(makeProps());
    const pauseUntil = new Date(Date.now() + 7 * 86400000);
    const resumed = s.pause(pauseUntil).resume();
    expect(resumed.status).toBe("ACTIVE");
  });

  it("throws when resuming non-paused subscription", () => {
    const s = Subscription.create(makeProps());
    expect(() => s.resume()).toThrow("Only paused subscriptions can be resumed");
  });

  it("calculates days until renewal", () => {
    const s = new Subscription(makeProps({
      currentPeriodEnd: new Date(Date.now() + 10 * 86400000),
    }));
    expect(s.daysUntilRenewal()).toBeGreaterThan(9);
    expect(s.daysUntilRenewal()).toBeLessThanOrEqual(11);
  });
});
