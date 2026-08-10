import { Plan, SEED_PLANS } from "@/domain/membership/Plan";

describe("Plan", () => {
  const monthly = new Plan(SEED_PLANS.find(p => p.id === "plan_monthly")!);
  const annual  = new Plan(SEED_PLANS.find(p => p.id === "plan_annual")!);
  const free    = new Plan(SEED_PLANS.find(p => p.id === "plan_free")!);

  it("free plan is identified correctly", () => {
    expect(free.isFree()).toBe(true);
    expect(monthly.isFree()).toBe(false);
    expect(annual.isFree()).toBe(false);
  });

  it("monthly plan has unlimited classes", () => {
    expect(monthly.hasUnlimitedClasses()).toBe(true);
    expect(free.hasUnlimitedClasses()).toBe(false);
  });

  it("monthly plan has ai_pose_coach feature", () => {
    expect(monthly.hasFeature("ai_pose_coach")).toBe(true);
    expect(free.hasFeature("ai_pose_coach")).toBe(false);
  });

  it("annual plan has one_on_one_sessions, monthly does not", () => {
    expect(annual.hasFeature("one_on_one_sessions")).toBe(true);
    expect(monthly.hasFeature("one_on_one_sessions")).toBe(false);
  });

  it("calculates annual savings vs monthly", () => {
    const savings = annual.annualSavingsVsMonthly(monthly);
    expect(savings).toBe(49 * 12 - 399); // 189
  });

  it("annual savings returns 0 for non-annual plan", () => {
    expect(monthly.annualSavingsVsMonthly(free)).toBe(0);
  });

  it("throws on negative price", () => {
    expect(() => new Plan({ ...SEED_PLANS[0], priceCAD: -1 })).toThrow("Price cannot be negative");
  });

  it("seed plans are all active", () => {
    SEED_PLANS.forEach(p => expect(p.isActive).toBe(true));
  });

  it("monthly plan has 7-day trial", () => {
    expect(monthly.trialDays).toBe(7);
    expect(free.trialDays).toBe(0);
  });
});
