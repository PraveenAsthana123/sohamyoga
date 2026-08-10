import { CouponCode } from "@/domain/campaign/CouponCode";

const future = new Date(Date.now() + 30 * 86400000);
const base = {
  id: "coup_1",
  code: "YOGA20",
  description: "20% off monthly plan",
  discountType: "percent" as const,
  discountValue: 20,
  maxUsageTotal: 100,
  maxUsagePerUser: 1,
  usageCount: 0,
  minimumSpendCAD: 0,
  validFrom: new Date(Date.now() - 86400000),
  validUntil: future,
  applicablePlanIds: [],
  isActive: true,
  createdById: "admin_1",
  createdAt: new Date(),
};

describe("CouponCode", () => {
  it("creates a valid coupon", () => {
    const c = new CouponCode(base);
    expect(c.code).toBe("YOGA20");
    expect(c.isValid()).toBe(true);
  });

  it("throws when code is not uppercase", () => {
    expect(() => new CouponCode({ ...base, code: "yoga20" })).toThrow("Coupon code must be uppercase");
  });

  it("throws when discount is 0 or negative", () => {
    expect(() => new CouponCode({ ...base, discountValue: 0 })).toThrow("Discount value must be > 0");
  });

  it("throws when percent discount exceeds 100", () => {
    expect(() => new CouponCode({ ...base, discountValue: 110 })).toThrow("Percent discount cannot exceed 100");
  });

  it("applies percent discount", () => {
    const c = new CouponCode(base);
    expect(c.applyDiscount(49)).toBeCloseTo(39.2);
  });

  it("applies fixed CAD discount", () => {
    const c = new CouponCode({ ...base, discountType: "fixed_cad", discountValue: 10 });
    expect(c.applyDiscount(49)).toBe(39);
  });

  it("does not go negative on fixed discount", () => {
    const c = new CouponCode({ ...base, discountType: "fixed_cad", discountValue: 100 });
    expect(c.applyDiscount(49)).toBe(0);
  });

  it("is invalid when expired", () => {
    const c = new CouponCode({ ...base, validUntil: new Date("2020-01-01"), validFrom: new Date("2019-01-01") });
    expect(c.isValid()).toBe(false);
  });

  it("is invalid when inactive", () => {
    const c = new CouponCode({ ...base, isActive: false });
    expect(c.isValid()).toBe(false);
  });

  it("is invalid when max usage reached", () => {
    const c = new CouponCode({ ...base, maxUsageTotal: 5, usageCount: 5 });
    expect(c.isValid()).toBe(false);
  });

  it("is valid when max usage is 0 (unlimited)", () => {
    const c = new CouponCode({ ...base, maxUsageTotal: 0, usageCount: 9999 });
    expect(c.isValid()).toBe(true);
  });

  it("redeems and increments usage count", () => {
    const c = new CouponCode(base).redeem();
    expect(c.usageCount).toBe(1);
  });

  it("throws when redeeming invalid coupon", () => {
    const c = new CouponCode({ ...base, isActive: false });
    expect(() => c.redeem()).toThrow("Coupon is not valid");
  });

  it("checks plan applicability — empty list means all plans", () => {
    const c = new CouponCode(base);
    expect(c.isValidForPlan("plan_monthly")).toBe(true);
    expect(c.isValidForPlan("plan_annual")).toBe(true);
  });

  it("checks plan applicability — specific plans", () => {
    const c = new CouponCode({ ...base, applicablePlanIds: ["plan_monthly"] });
    expect(c.isValidForPlan("plan_monthly")).toBe(true);
    expect(c.isValidForPlan("plan_annual")).toBe(false);
  });
});
