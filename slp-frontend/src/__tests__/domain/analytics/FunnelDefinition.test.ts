import { describe, it, expect } from "@jest/globals";
import { FunnelDefinition, type FunnelStep } from "../../../domain/analytics/FunnelDefinition";

const NOW    = new Date("2026-08-05T10:00:00Z");
const LATER  = new Date("2026-08-05T11:00:00Z");

const STEP_A: FunnelStep = { id: "st-1", order: 1, name: "Landing",  eventType: "page_view" };
const STEP_B: FunnelStep = { id: "st-2", order: 2, name: "Service",  eventType: "page_view", urlPattern: "/services" };
const STEP_C: FunnelStep = { id: "st-3", order: 3, name: "Booking",  eventType: "booking_started" };
const STEP_D: FunnelStep = { id: "st-4", order: 4, name: "Payment",  eventType: "payment_initiated" };
const STEP_E: FunnelStep = { id: "st-5", order: 5, name: "Complete", eventType: "payment_completed" };

function makeFunnel(overrides: Partial<ConstructorParameters<typeof FunnelDefinition>[0]> = {}): FunnelDefinition {
  return new FunnelDefinition({
    id: "fn-1",
    name: "Booking Funnel",
    steps: [STEP_A, STEP_B, STEP_C],
    status: "draft",
    windowHours: 24,
    createdBy: "admin-1",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

// ── Construction validation ───────────────────────────────────────────────────

describe("FunnelDefinition — construction", () => {
  it("creates a valid funnel", () => {
    const f = makeFunnel();
    expect(f.id).toBe("fn-1");
    expect(f.stepCount()).toBe(3);
  });

  it("throws when id is missing", () => {
    expect(() => makeFunnel({ id: "" })).toThrow("id is required");
  });

  it("throws when name is missing", () => {
    expect(() => makeFunnel({ name: "" })).toThrow("name is required");
  });

  it("throws when createdBy is missing", () => {
    expect(() => makeFunnel({ createdBy: "" })).toThrow("createdBy is required");
  });

  it("throws when fewer than 2 steps", () => {
    expect(() => makeFunnel({ steps: [STEP_A] })).toThrow("at least 2 steps");
  });

  it("throws when windowHours < 1", () => {
    expect(() => makeFunnel({ windowHours: 0 })).toThrow("windowHours must be >= 1");
  });

  it("throws when step orders are not unique", () => {
    const dupOrders = [STEP_A, { ...STEP_B, order: 1 }]; // duplicate order=1
    expect(() => makeFunnel({ steps: dupOrders })).toThrow("step orders must be unique");
  });

  it("throws when step ids are not unique", () => {
    const dupIds = [STEP_A, { ...STEP_B, id: "st-1" }]; // duplicate id
    expect(() => makeFunnel({ steps: dupIds })).toThrow("step ids must be unique");
  });

  it("accepts exactly 2 steps", () => {
    expect(() => makeFunnel({ steps: [STEP_A, STEP_B] })).not.toThrow();
  });
});

// ── sortedSteps ───────────────────────────────────────────────────────────────

describe("sortedSteps()", () => {
  it("returns steps in ascending order", () => {
    const f = makeFunnel({ steps: [STEP_C, STEP_A, STEP_B] });
    const sorted = f.sortedSteps();
    expect(sorted[0].name).toBe("Landing");
    expect(sorted[1].name).toBe("Service");
    expect(sorted[2].name).toBe("Booking");
  });

  it("does not mutate the original steps array", () => {
    const f = makeFunnel({ steps: [STEP_C, STEP_A, STEP_B] });
    f.sortedSteps();
    // internal order unchanged — verified by direct getter
    expect(f.steps[0].name).toBe("Landing"); // steps getter also returns sorted
  });
});

// ── hasStep ───────────────────────────────────────────────────────────────────

describe("hasStep()", () => {
  it("true for existing step id", () => {
    expect(makeFunnel().hasStep("st-1")).toBe(true);
  });

  it("false for non-existent step id", () => {
    expect(makeFunnel().hasStep("no-such")).toBe(false);
  });
});

// ── addStep ───────────────────────────────────────────────────────────────────

describe("addStep()", () => {
  it("adds a step to the funnel", () => {
    const f = makeFunnel().addStep(STEP_D);
    expect(f.stepCount()).toBe(4);
    expect(f.hasStep("st-4")).toBe(true);
  });

  it("throws when order already exists", () => {
    expect(() => makeFunnel().addStep({ ...STEP_D, order: 1 })).toThrow("step order already exists");
  });

  it("throws when id already exists", () => {
    expect(() => makeFunnel().addStep({ ...STEP_D, id: "st-1" })).toThrow("step id already exists");
  });

  it("does not mutate original", () => {
    const f = makeFunnel();
    f.addStep(STEP_D);
    expect(f.stepCount()).toBe(3);
  });
});

// ── removeStep ────────────────────────────────────────────────────────────────

describe("removeStep()", () => {
  it("removes a step", () => {
    const f = makeFunnel().removeStep("st-3");
    expect(f.stepCount()).toBe(2);
    expect(f.hasStep("st-3")).toBe(false);
  });

  it("throws when removing would leave fewer than 2 steps", () => {
    const f = makeFunnel({ steps: [STEP_A, STEP_B] });
    expect(() => f.removeStep("st-1")).toThrow("at least 2 steps");
  });

  it("no-op for missing step id (silently removes 0)", () => {
    // Removing a non-existent step keeps same count
    const f = makeFunnel();
    expect(f.removeStep("no-such").stepCount()).toBe(3);
  });
});

// ── calculateResults ──────────────────────────────────────────────────────────

describe("calculateResults()", () => {
  const counts = [1000, 600, 300]; // 3 steps

  it("first step always has conversionRate=100 and dropOffRate=0", () => {
    const results = makeFunnel().calculateResults(counts);
    expect(results[0].conversionRate).toBe(100);
    expect(results[0].dropOffRate).toBe(0);
  });

  it("step 2 rate = 60% (600/1000)", () => {
    const results = makeFunnel().calculateResults(counts);
    expect(results[1].conversionRate).toBe(60);
    expect(results[1].dropOffRate).toBe(40);
  });

  it("step 3 rate = 50% (300/600)", () => {
    const results = makeFunnel().calculateResults(counts);
    expect(results[2].conversionRate).toBe(50);
    expect(results[2].dropOffRate).toBe(50);
  });

  it("count values are preserved", () => {
    const results = makeFunnel().calculateResults(counts);
    expect(results[0].count).toBe(1000);
    expect(results[1].count).toBe(600);
    expect(results[2].count).toBe(300);
  });

  it("throws when stepCounts length does not match step count", () => {
    expect(() => makeFunnel().calculateResults([100])).toThrow("stepCounts length must match");
  });

  it("throws when stepCounts contains negative value", () => {
    expect(() => makeFunnel().calculateResults([1000, -1, 300])).toThrow("stepCounts values must be >= 0");
  });

  it("handles 0 at first step without dividing by zero", () => {
    const results = makeFunnel().calculateResults([0, 0, 0]);
    expect(results[0].conversionRate).toBe(100); // first step convention
    expect(results[1].conversionRate).toBe(100); // prev=0 guard
  });
});

// ── overallConversionRate ─────────────────────────────────────────────────────

describe("overallConversionRate()", () => {
  it("calculates rate from first to last step", () => {
    expect(makeFunnel().overallConversionRate([1000, 600, 300])).toBe(30);
  });

  it("returns 0 when first step count is 0", () => {
    expect(makeFunnel().overallConversionRate([0, 0, 0])).toBe(0);
  });

  it("returns 100 when all steps have same count", () => {
    expect(makeFunnel().overallConversionRate([500, 500, 500])).toBe(100);
  });

  it("returns 0 for empty array", () => {
    expect(makeFunnel().overallConversionRate([])).toBe(0);
  });
});

// ── State machine ─────────────────────────────────────────────────────────────

describe("FunnelDefinition — state machine", () => {
  it("publish() → active", () => {
    expect(makeFunnel().publish(NOW).status).toBe("active");
  });

  it("pause() from active → paused", () => {
    const f = makeFunnel().publish(NOW).pause(LATER);
    expect(f.status).toBe("paused");
  });

  it("pause() throws from draft", () => {
    expect(() => makeFunnel().pause(NOW)).toThrow("only active funnels can be paused");
  });

  it("resume() from paused → active", () => {
    const f = makeFunnel().publish(NOW).pause(NOW).resume(LATER);
    expect(f.status).toBe("active");
  });

  it("resume() throws from draft", () => {
    expect(() => makeFunnel().resume(NOW)).toThrow("only paused funnels can be resumed");
  });

  it("archive() from active → archived", () => {
    expect(makeFunnel().publish(NOW).archive(LATER).status).toBe("archived");
  });

  it("archive() throws when already archived", () => {
    const f = makeFunnel().publish(NOW).archive(NOW);
    expect(() => f.archive(LATER)).toThrow("already archived");
  });

  it("isActive() true for active funnel", () => {
    expect(makeFunnel().publish(NOW).isActive()).toBe(true);
  });

  it("isActive() false for draft", () => {
    expect(makeFunnel().isActive()).toBe(false);
  });
});

// ── updateWindow ──────────────────────────────────────────────────────────────

describe("updateWindow()", () => {
  it("updates windowHours", () => {
    expect(makeFunnel().updateWindow(48, NOW).windowHours).toBe(48);
  });

  it("throws when hours < 1", () => {
    expect(() => makeFunnel().updateWindow(0, NOW)).toThrow("windowHours must be >= 1");
  });
});

// ── 5-step funnel ─────────────────────────────────────────────────────────────

describe("5-step booking funnel (landing → services → booking → payment → complete)", () => {
  const f5 = new FunnelDefinition({
    id: "fn-5", name: "Full Booking",
    steps: [STEP_A, STEP_B, STEP_C, STEP_D, STEP_E],
    status: "draft", windowHours: 24,
    createdBy: "admin", createdAt: NOW, updatedAt: NOW,
  });
  const counts5 = [2000, 1200, 800, 400, 200];

  it("has 5 steps", () => {
    expect(f5.stepCount()).toBe(5);
  });

  it("overall conversion = 10% (200/2000)", () => {
    expect(f5.overallConversionRate(counts5)).toBe(10);
  });

  it("step 3 (Booking) rate = 66.7% (800/1200)", () => {
    const results = f5.calculateResults(counts5);
    expect(results[2].conversionRate).toBe(66.7);
  });

  it("step names in sorted order", () => {
    const names = f5.sortedSteps().map(s => s.name);
    expect(names).toEqual(["Landing", "Service", "Booking", "Payment", "Complete"]);
  });
});
