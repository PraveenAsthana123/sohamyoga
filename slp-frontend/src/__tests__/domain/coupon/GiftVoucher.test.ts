import { GiftVoucher, GiftVoucherProps } from "@/domain/coupon/GiftVoucher";

const ISSUED_AT = new Date("2026-01-01");
const EXPIRES_AT = new Date("2026-12-31");

const base: GiftVoucherProps = {
  id: "gv1",
  voucherCode: "GIFT-2026-0001",
  issuedBy: "admin1",
  originalValue: 100,
  currentBalance: 100,
  currency: "CAD",
  status: "issued",
  expiresAt: EXPIRES_AT,
  issuedAt: ISSUED_AT,
  transactions: [],
  notes: "",
  createdAt: ISSUED_AT,
  updatedAt: ISSUED_AT,
};

describe("GiftVoucher", () => {
  // --- Construction & validation ---
  it("creates valid gift voucher", () => {
    const v = new GiftVoucher(base);
    expect(v.voucherCode).toBe("GIFT-2026-0001");
    expect(v.originalValue).toBe(100);
    expect(v.currentBalance).toBe(100);
  });

  it("throws on blank voucher code", () => {
    expect(() => new GiftVoucher({ ...base, voucherCode: "  " })).toThrow("Voucher code required");
  });

  it("throws on zero original value", () => {
    expect(() => new GiftVoucher({ ...base, originalValue: 0 })).toThrow("Original value must be positive");
  });

  it("throws on negative original value", () => {
    expect(() => new GiftVoucher({ ...base, originalValue: -50 })).toThrow("Original value must be positive");
  });

  it("throws on negative balance", () => {
    expect(() => new GiftVoucher({ ...base, currentBalance: -1 })).toThrow("Balance cannot be negative");
  });

  it("throws when balance > original value", () => {
    expect(() => new GiftVoucher({ ...base, currentBalance: 150 })).toThrow("Balance cannot exceed original value");
  });

  it("throws when expiresAt <= issuedAt", () => {
    expect(() => new GiftVoucher({ ...base, expiresAt: ISSUED_AT })).toThrow("Expiry must be after issue date");
  });

  // --- Derived calculations ---
  it("totalRedeemed — 0 for fresh voucher", () => {
    expect(new GiftVoucher(base).totalRedeemed()).toBe(0);
  });

  it("totalRedeemed — correct after partial use", () => {
    const v = new GiftVoucher({ ...base, currentBalance: 60 });
    expect(v.totalRedeemed()).toBe(40);
  });

  it("percentageUsed — 0 for fresh", () => {
    expect(new GiftVoucher(base).percentageUsed()).toBe(0);
  });

  it("percentageUsed — 50 after half spent", () => {
    expect(new GiftVoucher({ ...base, currentBalance: 50 }).percentageUsed()).toBe(50);
  });

  it("isFullyRedeemed — false when balance > 0", () => {
    expect(new GiftVoucher(base).isFullyRedeemed()).toBe(false);
  });

  it("isFullyRedeemed — true when balance = 0", () => {
    expect(new GiftVoucher({ ...base, currentBalance: 0, status: "fully_redeemed" }).isFullyRedeemed()).toBe(true);
  });

  // --- Expiry ---
  it("isExpired — false within validity", () => {
    expect(new GiftVoucher(base).isExpired(new Date("2026-06-15"))).toBe(false);
  });

  it("isExpired — true after expiresAt", () => {
    expect(new GiftVoucher(base).isExpired(new Date("2027-01-01"))).toBe(true);
  });

  // --- canRedeem ---
  it("canRedeem — true when valid and sufficient balance", () => {
    expect(new GiftVoucher(base).canRedeem(50, new Date("2026-06-15"))).toBe(true);
  });

  it("canRedeem — false when expired", () => {
    expect(new GiftVoucher(base).canRedeem(50, new Date("2027-01-01"))).toBe(false);
  });

  it("canRedeem — false when cancelled", () => {
    expect(new GiftVoucher({ ...base, status: "cancelled" }).canRedeem(10, new Date("2026-06-01"))).toBe(false);
  });

  it("canRedeem — false when amount exceeds balance", () => {
    expect(new GiftVoucher({ ...base, currentBalance: 30 }).canRedeem(50, new Date("2026-06-01"))).toBe(false);
  });

  it("canRedeem — false for zero amount", () => {
    expect(new GiftVoucher(base).canRedeem(0, new Date("2026-06-01"))).toBe(false);
  });

  // --- redeem ---
  it("redeem partial — reduces balance and sets partially_redeemed", () => {
    const v = new GiftVoucher(base).redeem(40, "ord_1", "tx_1");
    expect(v.currentBalance).toBe(60);
    expect(v.status).toBe("partially_redeemed");
    expect(v.transactions).toHaveLength(1);
  });

  it("redeem full — sets fully_redeemed", () => {
    const v = new GiftVoucher(base).redeem(100, "ord_2", "tx_2");
    expect(v.currentBalance).toBe(0);
    expect(v.status).toBe("fully_redeemed");
  });

  it("redeem — throws on zero amount", () => {
    expect(() => new GiftVoucher(base).redeem(0, "ord_1", "tx_1")).toThrow("Redemption amount must be positive");
  });

  it("redeem — throws when canRedeem fails", () => {
    const expired = new GiftVoucher({ ...base, issuedAt: new Date("2020-01-01"), expiresAt: new Date("2021-01-01"), status: "expired" });
    expect(() => expired.redeem(50, "ord_1", "tx_1")).toThrow("Voucher cannot be redeemed");
  });

  it("redeem — transaction logged correctly", () => {
    const v = new GiftVoucher(base).redeem(25, "ord_3", "tx_3");
    expect(v.transactions[0].type).toBe("redemption");
    expect(v.transactions[0].amount).toBe(25);
    expect(v.transactions[0].orderId).toBe("ord_3");
  });

  // --- reverse ---
  it("reverse — restores balance for full refund", () => {
    const v = new GiftVoucher(base).redeem(100, "ord_1", "tx_1");
    const rev = v.reverse("tx_1", "rev_1", "Customer cancelled");
    expect(rev.currentBalance).toBe(100);
    expect(rev.status).toBe("issued");
    expect(rev.transactions).toHaveLength(2);
  });

  it("reverse — partial restore sets partially_redeemed", () => {
    const v = new GiftVoucher(base).redeem(40, "ord_1", "tx_1").redeem(30, "ord_2", "tx_2");
    const rev = v.reverse("tx_1", "rev_1", "Partial refund");
    expect(rev.currentBalance).toBe(70); // 30 + 40 restored
    expect(rev.status).toBe("partially_redeemed");
  });

  it("reverse — throws when transaction not found", () => {
    expect(() => new GiftVoucher(base).reverse("nonexistent", "rev_1", "reason")).toThrow("Redemption transaction not found");
  });

  it("reverse — throws on blank reason", () => {
    const v = new GiftVoucher(base).redeem(50, "ord_1", "tx_1");
    expect(() => v.reverse("tx_1", "rev_1", "  ")).toThrow("Reversal reason required");
  });

  // --- cancel ---
  it("cancel — transitions to cancelled", () => {
    const v = new GiftVoucher(base).cancel("Admin cancelled");
    expect(v.status).toBe("cancelled");
  });

  it("cancel — throws on blank reason", () => {
    expect(() => new GiftVoucher(base).cancel("  ")).toThrow("Cancellation reason required");
  });

  it("cancel — throws when already cancelled", () => {
    expect(() => new GiftVoucher({ ...base, status: "cancelled" }).cancel("again")).toThrow("Already cancelled");
  });

  it("cancel — throws when fully_redeemed", () => {
    expect(() => new GiftVoucher({ ...base, status: "fully_redeemed", currentBalance: 0 }).cancel("test")).toThrow("Cannot cancel a fully redeemed voucher");
  });

  // --- assign ---
  it("assign — sets issuedTo and recipientEmail", () => {
    const v = new GiftVoucher(base).assign("cust_42", "bob@example.com");
    expect(v.issuedTo).toBe("cust_42");
  });

  it("assign — throws if already assigned", () => {
    const v = new GiftVoucher({ ...base, issuedTo: "cust_1" });
    expect(() => v.assign("cust_2", "x@y.com")).toThrow("Voucher already assigned");
  });

  // --- Immutability ---
  it("immutable — redeem does not modify original", () => {
    const v = new GiftVoucher(base);
    v.redeem(30, "ord_1", "tx_1");
    expect(v.currentBalance).toBe(100);
  });
});
