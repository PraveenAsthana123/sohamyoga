import { Coupon, CouponProps, normalizeCouponCode } from "@/domain/coupon/Coupon";

const PAST   = new Date("2026-01-01");
const FUTURE = new Date("2026-12-31");

const base: CouponProps = {
  id: "c1",
  code: "SUMMER20",
  type: "percentage",
  name: "Summer 20% Off",
  description: "All classes",
  status: "active",
  discount: { type: "percentage", value: 20 },
  eligibility: {},
  limits: { perCustomerLimit: 1, perOrderLimit: 1, currentRedemptions: 0 },
  stackingRule: "combinable",
  stackingPriority: 10,
  validFrom: PAST,
  validTo: FUTURE,
  timezone: "America/Toronto",
  blackoutPeriods: [],
  distributionChannels: ["email"],
  isAutoApplied: false,
  isSingleUse: false,
  notes: "",
  createdBy: "admin1",
  createdAt: PAST,
  updatedAt: PAST,
};

describe("Coupon", () => {
  // --- Construction & validation ---
  it("creates valid coupon", () => {
    const c = new Coupon(base);
    expect(c.code).toBe("SUMMER20");
    expect(c.type).toBe("percentage");
    expect(c.status).toBe("active");
  });

  it("throws on blank code", () => {
    expect(() => new Coupon({ ...base, code: "   " })).toThrow("Coupon code required");
  });

  it("throws on lowercase code (not normalized)", () => {
    expect(() => new Coupon({ ...base, code: "summer20" })).toThrow("normalized to uppercase");
  });

  it("throws on blank name", () => {
    expect(() => new Coupon({ ...base, name: "  " })).toThrow("Coupon name required");
  });

  it("throws when validTo <= validFrom", () => {
    expect(() => new Coupon({ ...base, validTo: PAST, validFrom: PAST })).toThrow("Valid-to must be after valid-from");
  });

  it("throws on negative discount value", () => {
    expect(() => new Coupon({ ...base, discount: { type: "percentage", value: -1 } })).toThrow("Discount value cannot be negative");
  });

  it("throws on percentage > 100", () => {
    expect(() => new Coupon({ ...base, discount: { type: "percentage", value: 101 } })).toThrow("Percentage discount cannot exceed 100");
  });

  it("allows percentage = 100", () => {
    expect(() => new Coupon({ ...base, discount: { type: "percentage", value: 100 } })).not.toThrow();
  });

  it("throws on perCustomerLimit < 1", () => {
    expect(() => new Coupon({ ...base, limits: { ...base.limits, perCustomerLimit: 0 } })).toThrow("Per-customer limit must be >= 1");
  });

  it("throws on negative currentRedemptions", () => {
    expect(() => new Coupon({ ...base, limits: { ...base.limits, currentRedemptions: -1 } })).toThrow("Current redemptions cannot be negative");
  });

  // --- Date and validity ---
  it("isDateValid — true within range", () => {
    expect(new Coupon(base).isDateValid(new Date("2026-06-15"))).toBe(true);
  });

  it("isDateValid — false before validFrom", () => {
    expect(new Coupon(base).isDateValid(new Date("2025-12-31"))).toBe(false);
  });

  it("isExpired — false when validTo in future", () => {
    expect(new Coupon(base).isExpired(new Date("2026-06-01"))).toBe(false);
  });

  it("isExpired — true when validTo in past", () => {
    expect(new Coupon(base).isExpired(new Date("2027-01-01"))).toBe(true);
  });

  // --- Blackout periods ---
  it("addBlackout — throws when end <= start", () => {
    expect(() => new Coupon(base).addBlackout({ start: new Date("2026-07-10"), end: new Date("2026-07-05"), reason: "x" }))
      .toThrow("Blackout end must be after start");
  });

  it("isInBlackout — true during blackout", () => {
    const c = new Coupon(base).addBlackout({ start: new Date("2026-07-01"), end: new Date("2026-07-31"), reason: "Retreat" });
    expect(c.isInBlackout(new Date("2026-07-15"))).toBe(true);
  });

  it("isInBlackout — false outside blackout", () => {
    const c = new Coupon(base).addBlackout({ start: new Date("2026-07-01"), end: new Date("2026-07-31"), reason: "Retreat" });
    expect(c.isInBlackout(new Date("2026-06-15"))).toBe(false);
  });

  it("isActive — false during blackout", () => {
    const c = new Coupon(base).addBlackout({ start: new Date("2026-01-01"), end: new Date("2026-12-31"), reason: "All year" });
    expect(c.isActive(new Date("2026-06-01"))).toBe(false);
  });

  // --- Global limit / exhaustion ---
  it("isExhausted — false when under limit", () => {
    const c = new Coupon({ ...base, limits: { ...base.limits, globalLimit: 100, currentRedemptions: 50 } });
    expect(c.isExhausted()).toBe(false);
  });

  it("isExhausted — true when at limit", () => {
    const c = new Coupon({ ...base, limits: { ...base.limits, globalLimit: 50, currentRedemptions: 50 } });
    expect(c.isExhausted()).toBe(true);
  });

  it("remainingUses — null when unlimited", () => {
    expect(new Coupon(base).remainingUses()).toBeNull();
  });

  it("remainingUses — correct count", () => {
    const c = new Coupon({ ...base, limits: { ...base.limits, globalLimit: 100, currentRedemptions: 30 } });
    expect(c.remainingUses()).toBe(70);
  });

  it("incrementRedemption — bumps count", () => {
    const c = new Coupon(base).incrementRedemption();
    expect(c.currentRedemptions).toBe(1);
  });

  it("incrementRedemption — transitions to exhausted when hitting global limit", () => {
    const c = new Coupon({ ...base, limits: { ...base.limits, globalLimit: 1, currentRedemptions: 0 } });
    expect(c.incrementRedemption().status).toBe("exhausted");
  });

  // --- Stacking ---
  it("isExclusive — false for combinable", () => {
    expect(new Coupon(base).isExclusive()).toBe(false);
  });

  it("isExclusive — true for exclusive", () => {
    expect(new Coupon({ ...base, stackingRule: "exclusive" }).isExclusive()).toBe(true);
  });

  it("canStackWith — both combinable returns true", () => {
    const a = new Coupon(base);
    const b = new Coupon({ ...base, id: "c2", code: "SAVE10" });
    expect(a.canStackWith(b)).toBe(true);
  });

  it("canStackWith — one exclusive returns false", () => {
    const a = new Coupon(base);
    const b = new Coupon({ ...base, id: "c2", code: "VIP50", stackingRule: "exclusive" });
    expect(a.canStackWith(b)).toBe(false);
  });

  // --- Tier eligibility ---
  it("isEligibleForTier — true when no tier restriction", () => {
    expect(new Coupon(base).isEligibleForTier("bronze")).toBe(true);
  });

  it("isEligibleForTier — true for matching tier", () => {
    const c = new Coupon({ ...base, eligibility: { membershipTiers: ["gold", "platinum"] } });
    expect(c.isEligibleForTier("gold")).toBe(true);
  });

  it("isEligibleForTier — false for non-matching tier", () => {
    const c = new Coupon({ ...base, eligibility: { membershipTiers: ["gold", "platinum"] } });
    expect(c.isEligibleForTier("bronze")).toBe(false);
  });

  // --- Discount calculation ---
  it("calculateDiscount — percentage", () => {
    expect(new Coupon(base).calculateDiscount(100)).toBeCloseTo(20);
  });

  it("calculateDiscount — percentage with cap", () => {
    const c = new Coupon({ ...base, discount: { type: "percentage", value: 20, maxDiscountAmount: 10 } });
    expect(c.calculateDiscount(200)).toBe(10);
  });

  it("calculateDiscount — fixed_amount", () => {
    const c = new Coupon({ ...base, discount: { type: "fixed_amount", value: 15 } });
    expect(c.calculateDiscount(100)).toBe(15);
  });

  it("calculateDiscount — fixed_amount cannot exceed order amount", () => {
    const c = new Coupon({ ...base, discount: { type: "fixed_amount", value: 50 } });
    expect(c.calculateDiscount(20)).toBe(20);
  });

  it("calculateDiscount — free_units requires unitPrice", () => {
    const c = new Coupon({ ...base, discount: { type: "free_units", value: 1, freeUnits: 2 } });
    expect(() => c.calculateDiscount(100)).toThrow("Unit price required");
  });

  it("calculateDiscount — free_units with unitPrice", () => {
    const c = new Coupon({ ...base, discount: { type: "free_units", value: 1, freeUnits: 2 } });
    expect(c.calculateDiscount(100, 30)).toBe(60);
  });

  it("calculateDiscount — throws when coupon not active", () => {
    const c = new Coupon({ ...base, status: "draft" });
    expect(() => c.calculateDiscount(100)).toThrow("Coupon is not active");
  });

  // --- State machine ---
  it("submit — draft → pending_approval", () => {
    const c = new Coupon({ ...base, status: "draft" }).submit();
    expect(c.status).toBe("pending_approval");
  });

  it("submit — throws if not draft", () => {
    expect(() => new Coupon(base).submit()).toThrow("Only draft coupons can be submitted");
  });

  it("approve — pending → active (validFrom in past)", () => {
    const c = new Coupon({ ...base, status: "pending_approval" }).approve("mgr1");
    expect(c.status).toBe("active");
    expect(c.approvedBy).toBe("mgr1");
  });

  it("approve — pending → scheduled (validFrom in future)", () => {
    const future = new Date(Date.now() + 30 * 86400000);
    const farFuture = new Date(Date.now() + 60 * 86400000);
    const c = new Coupon({ ...base, status: "pending_approval", validFrom: future, validTo: farFuture }).approve("mgr1");
    expect(c.status).toBe("scheduled");
  });

  it("approve — throws without approverID", () => {
    expect(() => new Coupon({ ...base, status: "pending_approval" }).approve("  ")).toThrow("Approver ID required");
  });

  it("reject — pending → draft", () => {
    const c = new Coupon({ ...base, status: "pending_approval" }).reject("Not approved");
    expect(c.status).toBe("draft");
  });

  it("activate — scheduled → active", () => {
    const c = new Coupon({ ...base, status: "scheduled" }).activate();
    expect(c.status).toBe("active");
  });

  it("activate — paused → active", () => {
    const c = new Coupon({ ...base, status: "paused" }).activate();
    expect(c.status).toBe("active");
  });

  it("activate — throws from draft", () => {
    expect(() => new Coupon({ ...base, status: "draft" }).activate()).toThrow("Can only activate scheduled or paused");
  });

  it("pause — active → paused", () => {
    const c = new Coupon(base).pause("High redemption rate");
    expect(c.status).toBe("paused");
    expect(c.pauseReason).toBe("High redemption rate");
  });

  it("pause — throws without reason", () => {
    expect(() => new Coupon(base).pause("  ")).toThrow("Pause reason required");
  });

  it("revoke — sets revokedBy and revokedReason", () => {
    const c = new Coupon(base).revoke("admin1", "Fraud detected");
    expect(c.status).toBe("revoked");
    expect(c.revokedBy).toBe("admin1");
    expect(c.revokedReason).toBe("Fraud detected");
  });

  it("revoke — throws if already revoked", () => {
    expect(() => new Coupon({ ...base, status: "revoked" }).revoke("a", "r")).toThrow("Already revoked");
  });

  // --- External link & utility ---
  it("linkOfferKit — stores ID", () => {
    expect(new Coupon(base).linkOfferKit("ok_789").offerKitId).toBe("ok_789");
  });

  it("normalizeCouponCode — trims and uppercases", () => {
    expect(normalizeCouponCode("  summer 20  ")).toBe("SUMMER20");
  });

  it("immutable — pause does not modify original", () => {
    const c = new Coupon(base);
    c.pause("test");
    expect(c.status).toBe("active");
  });
});
