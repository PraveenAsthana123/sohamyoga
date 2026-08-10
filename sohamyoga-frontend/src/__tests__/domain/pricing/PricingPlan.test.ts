import { PricingPlan, PricingPlanProps, PlanBenefits, PlanPrice, FreezePolicy, PausePolicy } from "@/domain/pricing/PricingPlan";

const PRICES: PlanPrice[] = [
  { amount: 99, currency: "CAD", billingCycle: "monthly" },
  { amount: 269, currency: "CAD", billingCycle: "quarterly" },
  { amount: 999, currency: "CAD", billingCycle: "annual" },
];

const BENEFITS: PlanBenefits = {
  unlimitedClasses: true,
  workshopDiscountPercent: 10,
  retreatDiscountPercent: 5,
  storeDiscountPercent: 5,
  priorityBooking: false,
  vipSeating: false,
  teacherConsultationMinutes: 0,
  nutritionConsultationMinutes: 0,
  meditationSessions: 2,
  videoLibraryAccess: true,
  premiumContentAccess: false,
  certificateIssuance: false,
  corporateEventsAccess: false,
  exclusiveCommunityAccess: false,
};

const FREEZE: FreezePolicy = { allowed: true,  maxDaysPerYear: 30, noticeDaysRequired: 3, maxTimesPerYear: 2 };
const PAUSE:  PausePolicy  = { allowed: true,  maxDaysPerYear: 60, maxTimesPerYear: 3,  noticeDaysRequired: 1 };

const base: PricingPlanProps = {
  id: "plan_silver",
  name: "Silver Membership",
  slug: "silver-monthly",
  type: "silver",
  description: "Entry-level membership",
  status: "active",
  prices: PRICES,
  benefits: BENEFITS,
  gracePeriodDays: 7,
  freezePolicy: FREEZE,
  pausePolicy: PAUSE,
  upgradeableTo: ["plan_gold", "plan_platinum"],
  downgradeableTo: [],
  isGiftable: true,
  isTransferable: false,
  sortOrder: 1,
  metadata: {},
  createdBy: "admin1",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("PricingPlan", () => {
  it("creates valid plan", () => {
    const p = new PricingPlan(base);
    expect(p.name).toBe("Silver Membership");
    expect(p.type).toBe("silver");
    expect(p.status).toBe("active");
  });

  it("throws on blank name", () => {
    expect(() => new PricingPlan({ ...base, name: "  " })).toThrow("Plan name required");
  });

  it("throws on blank slug", () => {
    expect(() => new PricingPlan({ ...base, slug: "" })).toThrow("Slug required");
  });

  it("throws on invalid slug (uppercase)", () => {
    expect(() => new PricingPlan({ ...base, slug: "Silver-Monthly" })).toThrow("Slug must be lowercase kebab-case");
  });

  it("throws when prices array is empty", () => {
    expect(() => new PricingPlan({ ...base, prices: [] })).toThrow("At least one price required");
  });

  it("throws on negative price amount", () => {
    expect(() => new PricingPlan({ ...base, prices: [{ amount: -1, currency: "CAD", billingCycle: "monthly" }] })).toThrow("Price amount cannot be negative");
  });

  it("throws on negative gracePeriodDays", () => {
    expect(() => new PricingPlan({ ...base, gracePeriodDays: -1 })).toThrow("Grace period cannot be negative");
  });

  it("throws on invalid workshopDiscountPercent", () => {
    expect(() => new PricingPlan({ ...base, benefits: { ...BENEFITS, workshopDiscountPercent: 110 } })).toThrow("Workshop discount percent must be 0-100");
  });

  // --- priceFor ---
  it("priceFor — returns matching price", () => {
    const p = new PricingPlan(base).priceFor("CAD", "monthly");
    expect(p.amount).toBe(99);
  });

  it("priceFor — throws when currency/cycle not found", () => {
    expect(() => new PricingPlan(base).priceFor("USD", "monthly")).toThrow("No price for USD/monthly");
  });

  // --- dailyRate ---
  it("dailyRate — monthly: 99/30 = 3.30", () => {
    expect(new PricingPlan(base).dailyRate("CAD", "monthly")).toBe(3.30);
  });

  it("dailyRate — annual: 999/365 = 2.74", () => {
    expect(new PricingPlan(base).dailyRate("CAD", "annual")).toBe(2.74);
  });

  it("dailyRate — quarterly: 269/90 = 2.99", () => {
    expect(new PricingPlan(base).dailyRate("CAD", "quarterly")).toBe(2.99);
  });

  // --- upgrade/downgrade paths ---
  it("canUpgradeTo — true for listed plan", () => {
    expect(new PricingPlan(base).canUpgradeTo("plan_gold")).toBe(true);
  });

  it("canUpgradeTo — false for unlisted plan", () => {
    expect(new PricingPlan(base).canUpgradeTo("plan_family")).toBe(false);
  });

  it("canDowngradeTo — false when downgradeableTo is empty", () => {
    expect(new PricingPlan(base).canDowngradeTo("plan_trial")).toBe(false);
  });

  it("canDowngradeTo — true when listed", () => {
    const p = new PricingPlan({ ...base, downgradeableTo: ["plan_trial"] });
    expect(p.canDowngradeTo("plan_trial")).toBe(true);
  });

  // --- Policies ---
  it("canFreeze — true when freeze allowed", () => {
    expect(new PricingPlan(base).canFreeze()).toBe(true);
  });

  it("canFreeze — false when not allowed", () => {
    const p = new PricingPlan({ ...base, freezePolicy: { ...FREEZE, allowed: false } });
    expect(p.canFreeze()).toBe(false);
  });

  it("canPause — true when pause allowed", () => {
    expect(new PricingPlan(base).canPause()).toBe(true);
  });

  it("gracePeriodDays — returns correct value", () => {
    expect(new PricingPlan(base).gracePeriodDays).toBe(7);
  });

  // --- Plan type checks ---
  it("isTrialPlan — false for silver", () => {
    expect(new PricingPlan(base).isTrialPlan()).toBe(false);
  });

  it("isTrialPlan — true for trial type", () => {
    const p = new PricingPlan({ ...base, type: "trial", slug: "trial-14day", prices: [{ amount: 0, currency: "CAD", billingCycle: "one_time" }] });
    expect(p.isTrialPlan()).toBe(true);
  });

  it("isFamilyPlan — true for family type", () => {
    const p = new PricingPlan({ ...base, type: "family", slug: "family-monthly" });
    expect(p.isFamilyPlan()).toBe(true);
  });

  // --- State machine ---
  it("activate — draft → active", () => {
    const p = new PricingPlan({ ...base, status: "draft" }).activate();
    expect(p.status).toBe("active");
  });

  it("activate — throws if not draft", () => {
    expect(() => new PricingPlan(base).activate()).toThrow("Only draft plans can be activated");
  });

  it("deprecate — active → deprecated", () => {
    expect(new PricingPlan(base).deprecate().status).toBe("deprecated");
  });

  it("deprecate — throws if not active", () => {
    expect(() => new PricingPlan({ ...base, status: "draft" }).deprecate()).toThrow("Only active plans can be deprecated");
  });

  it("archive — from deprecated → archived", () => {
    expect(new PricingPlan({ ...base, status: "deprecated" }).archive().status).toBe("archived");
  });

  it("archive — throws if already archived", () => {
    expect(() => new PricingPlan({ ...base, status: "archived" }).archive()).toThrow("Already archived");
  });

  // --- addPrice ---
  it("addPrice — adds new currency/cycle", () => {
    const p = new PricingPlan(base).addPrice({ amount: 79, currency: "USD", billingCycle: "monthly" });
    expect(p.priceFor("USD", "monthly").amount).toBe(79);
    expect(p.prices).toHaveLength(4);
  });

  it("addPrice — replaces existing same currency+cycle", () => {
    const p = new PricingPlan(base).addPrice({ amount: 109, currency: "CAD", billingCycle: "monthly" });
    expect(p.priceFor("CAD", "monthly").amount).toBe(109);
    expect(p.prices).toHaveLength(3); // replaced, not added
  });

  it("removePrice — throws when removing last price", () => {
    const single = new PricingPlan({ ...base, prices: [{ amount: 99, currency: "CAD", billingCycle: "monthly" }] });
    expect(() => single.removePrice("CAD", "monthly")).toThrow("Cannot remove last price");
  });

  // --- Benefits ---
  it("benefits.unlimitedClasses is true", () => {
    expect(new PricingPlan(base).benefits.unlimitedClasses).toBe(true);
  });

  it("isGiftable returns true", () => {
    expect(new PricingPlan(base).isGiftable).toBe(true);
  });

  it("sortOrder returns 1", () => {
    expect(new PricingPlan(base).sortOrder).toBe(1);
  });

  // --- Immutability ---
  it("immutable — deprecate does not modify original", () => {
    const p = new PricingPlan(base);
    p.deprecate();
    expect(p.status).toBe("active");
  });
});
