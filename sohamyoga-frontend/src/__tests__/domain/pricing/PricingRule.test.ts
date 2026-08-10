import { PricingRule, PricingRuleProps } from "@/domain/pricing/PricingRule";

const base: PricingRuleProps = {
  id: "pr1",
  name: "Summer 20% Off",
  description: "All yoga classes",
  type: "percentage_off",
  status: "active",
  priority: 10,
  stackingBehavior: "combinable",
  condition: {
    segments: ["all"],
    validFrom: new Date("2026-06-01"),
    validTo: new Date("2026-09-30"),
  },
  action: { type: "percentage_discount", value: 20 },
  currentApplications: 0,
  notes: "",
  createdBy: "admin1",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("PricingRule", () => {
  it("creates valid pricing rule", () => {
    const r = new PricingRule(base);
    expect(r.name).toBe("Summer 20% Off");
    expect(r.type).toBe("percentage_off");
    expect(r.status).toBe("active");
  });

  it("throws on blank name", () => {
    expect(() => new PricingRule({ ...base, name: "  " })).toThrow("Rule name required");
  });

  it("throws on priority < 1", () => {
    expect(() => new PricingRule({ ...base, priority: 0 })).toThrow("Priority must be >= 1");
  });

  it("throws on negative action value", () => {
    expect(() => new PricingRule({ ...base, action: { type: "percentage_discount", value: -1 } })).toThrow("Action value cannot be negative");
  });

  it("throws when percentage > 100", () => {
    expect(() => new PricingRule({ ...base, action: { type: "percentage_discount", value: 101 } })).toThrow("Percentage discount cannot exceed 100");
  });

  it("allows percentage = 100", () => {
    expect(() => new PricingRule({ ...base, action: { type: "percentage_discount", value: 100 } })).not.toThrow();
  });

  it("throws on invalid startHour", () => {
    expect(() => new PricingRule({ ...base, condition: { ...base.condition, startHour: 25 } })).toThrow("startHour must be 0-23");
  });

  // --- isExpired ---
  it("isExpired — false when within validTo", () => {
    expect(new PricingRule(base).isExpired(new Date("2026-08-01"))).toBe(false);
  });

  it("isExpired — true when past validTo", () => {
    expect(new PricingRule(base).isExpired(new Date("2026-10-01"))).toBe(true);
  });

  it("isExpired — false when no validTo", () => {
    const r = new PricingRule({ ...base, condition: { segments: ["all"] } });
    expect(r.isExpired()).toBe(false);
  });

  // --- isExhausted ---
  it("isExhausted — false when under max", () => {
    const r = new PricingRule({ ...base, maxApplicationsTotal: 100, currentApplications: 50 });
    expect(r.isExhausted()).toBe(false);
  });

  it("isExhausted — true at max", () => {
    const r = new PricingRule({ ...base, maxApplicationsTotal: 10, currentApplications: 10 });
    expect(r.isExhausted()).toBe(true);
  });

  // --- isApplicable ---
  it("isApplicable — true when active and within dates", () => {
    expect(new PricingRule(base).isApplicable(new Date("2026-07-01"))).toBe(true);
  });

  it("isApplicable — false when paused", () => {
    expect(new PricingRule({ ...base, status: "paused" }).isApplicable()).toBe(false);
  });

  it("isApplicable — false when expired", () => {
    expect(new PricingRule(base).isApplicable(new Date("2027-01-01"))).toBe(false);
  });

  it("isApplicable — false when exhausted", () => {
    const r = new PricingRule({ ...base, maxApplicationsTotal: 5, currentApplications: 5 });
    expect(r.isApplicable()).toBe(false);
  });

  it("isApplicable — false when before validFrom", () => {
    expect(new PricingRule(base).isApplicable(new Date("2026-05-01"))).toBe(false);
  });

  // --- applyToAmount ---
  it("applyToAmount — percentage discount", () => {
    expect(new PricingRule(base).applyToAmount(100)).toBeCloseTo(20);
  });

  it("applyToAmount — percentage with cap", () => {
    const r = new PricingRule({ ...base, action: { type: "percentage_discount", value: 20, maxDiscountAmount: 10 } });
    expect(r.applyToAmount(200)).toBe(10);
  });

  it("applyToAmount — fixed discount", () => {
    const r = new PricingRule({ ...base, action: { type: "fixed_discount", value: 15 } });
    expect(r.applyToAmount(100)).toBe(15);
  });

  it("applyToAmount — fixed discount capped at order amount", () => {
    const r = new PricingRule({ ...base, action: { type: "fixed_discount", value: 50 } });
    expect(r.applyToAmount(30)).toBe(30);
  });

  it("applyToAmount — free_units requires unitPrice", () => {
    const r = new PricingRule({ ...base, action: { type: "free_units", value: 1, freeUnits: 2 } });
    expect(() => r.applyToAmount(100)).toThrow("Unit price required");
  });

  it("applyToAmount — free_units with unitPrice", () => {
    const r = new PricingRule({ ...base, action: { type: "free_units", value: 1, freeUnits: 3 } });
    expect(r.applyToAmount(200, 25)).toBe(75);
  });

  it("applyToAmount — throws when not applicable", () => {
    expect(() => new PricingRule({ ...base, status: "paused" }).applyToAmount(100)).toThrow("Rule is not applicable");
  });

  // --- incrementApplications ---
  it("incrementApplications — bumps count", () => {
    const r = new PricingRule(base).incrementApplications();
    expect(r.currentApplications).toBe(1);
  });

  it("incrementApplications — transitions to exhausted at max", () => {
    const r = new PricingRule({ ...base, maxApplicationsTotal: 1 });
    expect(r.incrementApplications().status).toBe("exhausted");
  });

  // --- State machine ---
  it("activate — draft → active", () => {
    expect(new PricingRule({ ...base, status: "draft" }).activate().status).toBe("active");
  });

  it("activate — throws if not draft", () => {
    expect(() => new PricingRule(base).activate()).toThrow("Only draft rules can be activated");
  });

  it("pause — active → paused", () => {
    expect(new PricingRule(base).pause().status).toBe("paused");
  });

  it("pause — throws if not active", () => {
    expect(() => new PricingRule({ ...base, status: "draft" }).pause()).toThrow("Only active rules can be paused");
  });

  it("resume — paused → active", () => {
    expect(new PricingRule({ ...base, status: "paused" }).resume().status).toBe("active");
  });

  it("archive — active → archived", () => {
    expect(new PricingRule(base).archive().status).toBe("archived");
  });

  it("archive — throws if already archived", () => {
    expect(() => new PricingRule({ ...base, status: "archived" }).archive()).toThrow("Already archived");
  });

  // --- Immutability ---
  it("immutable — pause does not modify original", () => {
    const r = new PricingRule(base);
    r.pause();
    expect(r.status).toBe("active");
  });
});
