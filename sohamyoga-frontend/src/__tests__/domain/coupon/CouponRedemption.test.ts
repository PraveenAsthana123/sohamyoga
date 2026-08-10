import { CouponRedemption, CouponRedemptionProps } from "@/domain/coupon/CouponRedemption";

// Future dates — reservation is still active when tests run
const RESERVED_AT = new Date("2026-11-01T10:00:00Z");
const EXPIRES_AT  = new Date("2026-11-01T10:15:00Z");

// Past dates — reservation has expired
const PAST_RESERVED = new Date("2026-01-01T10:00:00Z");
const PAST_EXPIRES  = new Date("2026-01-01T10:15:00Z");

const base: CouponRedemptionProps = {
  id: "r1",
  couponId: "c1",
  couponCode: "SUMMER20",
  customerId: "cust_01",
  customerEmail: "alice@example.com",
  status: "reserved",
  orderAmount: 100,
  discountAmount: 20,
  finalAmount: 80,
  currency: "CAD",
  reservedAt: RESERVED_AT,
  reservationExpiresAt: EXPIRES_AT,
  channel: "web",
  notes: "",
  createdAt: RESERVED_AT,
  updatedAt: RESERVED_AT,
};

describe("CouponRedemption", () => {
  // --- Construction & validation ---
  it("creates valid reservation", () => {
    const r = new CouponRedemption(base);
    expect(r.couponCode).toBe("SUMMER20");
    expect(r.status).toBe("reserved");
  });

  it("throws on blank couponId", () => {
    expect(() => new CouponRedemption({ ...base, couponId: "  " })).toThrow("Coupon ID required");
  });

  it("throws on blank customerId", () => {
    expect(() => new CouponRedemption({ ...base, customerId: "" })).toThrow("Customer ID required");
  });

  it("throws when orderAmount is negative", () => {
    expect(() => new CouponRedemption({ ...base, orderAmount: -1, discountAmount: 0, finalAmount: -1 })).toThrow("Order amount cannot be negative");
  });

  it("throws when discountAmount > orderAmount", () => {
    expect(() => new CouponRedemption({ ...base, discountAmount: 150, finalAmount: -50 })).toThrow("Discount cannot exceed order amount");
  });

  it("throws when finalAmount does not equal orderAmount - discountAmount", () => {
    expect(() => new CouponRedemption({ ...base, finalAmount: 90 })).toThrow("Final amount must equal order amount minus discount");
  });

  it("throws when reservationExpiresAt <= reservedAt", () => {
    expect(() => new CouponRedemption({ ...base, reservationExpiresAt: RESERVED_AT })).toThrow("Reservation expiry must be after reserved-at");
  });

  // --- Derived calculations ---
  it("savingsAmount — returns discountAmount", () => {
    expect(new CouponRedemption(base).savingsAmount()).toBe(20);
  });

  it("savingsPercent — 20% of CAD 100", () => {
    expect(new CouponRedemption(base).savingsPercent()).toBe(20);
  });

  it("savingsPercent — 0 when orderAmount is zero", () => {
    const r = new CouponRedemption({ ...base, orderAmount: 0, discountAmount: 0, finalAmount: 0 });
    expect(r.savingsPercent()).toBe(0);
  });

  // --- Reservation expiry ---
  it("isReservationExpired — false when future reservation", () => {
    // EXPIRES_AT is in the future; checking with a time before it
    expect(new CouponRedemption(base).isReservationExpired(new Date("2026-11-01T10:10:00Z"))).toBe(false);
  });

  it("isReservationExpired — true for past-expired reservation", () => {
    // PAST_EXPIRES is in the past; using default clock (now > past)
    const expired = new CouponRedemption({ ...base, reservedAt: PAST_RESERVED, reservationExpiresAt: PAST_EXPIRES });
    expect(expired.isReservationExpired()).toBe(true);
  });

  it("isReservationExpired — false for non-reserved status even if time has passed", () => {
    const committed: CouponRedemptionProps = {
      ...base,
      reservedAt: PAST_RESERVED,
      reservationExpiresAt: PAST_EXPIRES,
      status: "committed",
      committedAt: new Date(),
      orderId: "ord_x",
    };
    expect(new CouponRedemption(committed).isReservationExpired()).toBe(false);
  });

  // --- isSettled ---
  it("isSettled — false when reserved", () => {
    expect(new CouponRedemption(base).isSettled()).toBe(false);
  });

  it("isSettled — true when committed", () => {
    const r: CouponRedemptionProps = { ...base, status: "committed", committedAt: new Date(), orderId: "ord_1" };
    expect(new CouponRedemption(r).isSettled()).toBe(true);
  });

  it("isSettled — true when cancelled", () => {
    const r: CouponRedemptionProps = { ...base, status: "cancelled", cancelReason: "User abort", cancelledAt: new Date() };
    expect(new CouponRedemption(r).isSettled()).toBe(true);
  });

  // --- commit ---
  it("commit — reserved → committed with orderId", () => {
    const r = new CouponRedemption(base).commit("ord_001");
    expect(r.status).toBe("committed");
    expect(r.orderId).toBe("ord_001");
    expect(r.committedAt).toBeDefined();
  });

  it("commit — throws on blank orderId", () => {
    expect(() => new CouponRedemption(base).commit("  ")).toThrow("Order ID required");
  });

  it("commit — throws when not reserved", () => {
    const r: CouponRedemptionProps = { ...base, status: "cancelled", cancelReason: "test", cancelledAt: new Date() };
    expect(() => new CouponRedemption(r).commit("ord_1")).toThrow("Can only commit a reserved redemption");
  });

  it("commit — throws when reservation expired (past dates)", () => {
    const expired = new CouponRedemption({ ...base, reservedAt: PAST_RESERVED, reservationExpiresAt: PAST_EXPIRES });
    expect(() => expired.commit("ord_1")).toThrow("Reservation has expired");
  });

  // --- cancel ---
  it("cancel — reserved → cancelled", () => {
    const r = new CouponRedemption(base).cancel("User abandoned cart");
    expect(r.status).toBe("cancelled");
    expect(r.cancelReason).toBe("User abandoned cart");
  });

  it("cancel — throws on blank reason", () => {
    expect(() => new CouponRedemption(base).cancel("  ")).toThrow("Cancellation reason required");
  });

  it("cancel — throws when committed", () => {
    const r: CouponRedemptionProps = { ...base, status: "committed", committedAt: new Date(), orderId: "ord_1" };
    expect(() => new CouponRedemption(r).cancel("test")).toThrow("Can only cancel a reserved redemption");
  });

  // --- reverse ---
  it("reverse — committed → reversed", () => {
    const r: CouponRedemptionProps = { ...base, status: "committed", orderId: "ord_1", committedAt: new Date() };
    const rev = new CouponRedemption(r).reverse("Customer refund");
    expect(rev.status).toBe("reversed");
    expect(rev.reverseReason).toBe("Customer refund");
  });

  it("reverse — throws on blank reason", () => {
    const r: CouponRedemptionProps = { ...base, status: "committed", orderId: "o1", committedAt: new Date() };
    expect(() => new CouponRedemption(r).reverse("  ")).toThrow("Reversal reason required");
  });

  it("reverse — throws when not committed", () => {
    expect(() => new CouponRedemption(base).reverse("test")).toThrow("Can only reverse a committed redemption");
  });

  // --- Factory ---
  it("createReservation — builds reserved status with TTL 15 min ahead", () => {
    const { status, reservedAt, reservationExpiresAt, createdAt, updatedAt, ...rest } = base;
    const r = CouponRedemption.createReservation({ ...rest });
    expect(r.status).toBe("reserved");
    const ttlMs = r.reservationExpiresAt.getTime() - r.reservedAt.getTime();
    expect(ttlMs).toBe(15 * 60 * 1000);
  });

  // --- Immutability ---
  it("immutable — commit does not modify original", () => {
    const r = new CouponRedemption(base);
    r.commit("ord_1");
    expect(r.status).toBe("reserved");
  });
});
