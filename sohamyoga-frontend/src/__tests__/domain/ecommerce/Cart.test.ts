import { Cart, CartProps, CartItem } from "@/domain/ecommerce/Cart";

const PHYSICAL_ITEM: CartItem = {
  id: "ci1", productId: "p1", productName: "Yoga Mat", productType: "physical",
  sku: "YM-001", quantity: 1, unitPrice: 69.99,
  isDigital: false, requiresShipping: true,
};

const DIGITAL_ITEM: CartItem = {
  id: "ci2", productId: "p2", productName: "Yoga Course", productType: "digital",
  sku: "COURSE-001", quantity: 1, unitPrice: 49.99,
  isDigital: true, requiresShipping: false,
};

const BASE: CartProps = {
  id: "cart_1", customerId: "cust_1", currency: "CAD",
  items: [PHYSICAL_ITEM],
  couponDiscount: 0, giftCardAmount: 0, walletAmount: 0,
  rewardPointsUsed: 0, rewardPointsValuePerPoint: 0.05,
  shippingCost: 5.0, taxRate: 0.13,
  createdAt: new Date("2026-08-01"), updatedAt: new Date("2026-08-01"),
};

describe("Cart", () => {
  // ─── Constructor validation ───────────────────────────────────────────────

  it("creates valid cart", () => {
    const c = new Cart(BASE);
    expect(c.id).toBe("cart_1");
    expect(c.currency).toBe("CAD");
  });

  it("throws on empty id", () => {
    expect(() => new Cart({ ...BASE, id: "  " })).toThrow("Cart ID required");
  });

  it("throws on empty currency", () => {
    expect(() => new Cart({ ...BASE, currency: "" })).toThrow("Currency required");
  });

  it("throws on negative couponDiscount", () => {
    expect(() => new Cart({ ...BASE, couponDiscount: -1 })).toThrow("negative");
  });

  it("throws on negative giftCardAmount", () => {
    expect(() => new Cart({ ...BASE, giftCardAmount: -1 })).toThrow("negative");
  });

  it("throws on negative walletAmount", () => {
    expect(() => new Cart({ ...BASE, walletAmount: -1 })).toThrow("negative");
  });

  it("throws on negative rewardPoints", () => {
    expect(() => new Cart({ ...BASE, rewardPointsUsed: -1 })).toThrow("negative");
  });

  it("throws on negative shippingCost", () => {
    expect(() => new Cart({ ...BASE, shippingCost: -1 })).toThrow("negative");
  });

  it("throws on taxRate > 1", () => {
    expect(() => new Cart({ ...BASE, taxRate: 1.5 })).toThrow("0–1");
  });

  it("throws on item with quantity < 1", () => {
    expect(() => new Cart({ ...BASE, items: [{ ...PHYSICAL_ITEM, quantity: 0 }] })).toThrow("quantity");
  });

  it("throws on item with negative unitPrice", () => {
    expect(() => new Cart({ ...BASE, items: [{ ...PHYSICAL_ITEM, unitPrice: -1 }] })).toThrow("negative");
  });

  // ─── Computed totals ──────────────────────────────────────────────────────

  it("subtotal sums item prices", () => {
    const c = new Cart(BASE);
    expect(c.subtotal()).toBe(69.99);
  });

  it("subtotal with multiple items", () => {
    const c = new Cart({ ...BASE, items: [PHYSICAL_ITEM, DIGITAL_ITEM] });
    expect(c.subtotal()).toBe(119.98);
  });

  it("tax is applied to subtotal minus coupon discount", () => {
    const c = new Cart({ ...BASE, couponDiscount: 10 });
    // taxableAmount = 69.99 - 10 = 59.99; tax = 59.99 * 0.13 = 7.7987 ≈ 7.80
    expect(c.tax()).toBeCloseTo(7.80, 1);
  });

  it("total = subtotal + shipping + tax - totalDiscount", () => {
    const c = new Cart(BASE);
    const expected = 69.99 + 5.0 + Math.round(69.99 * 0.13 * 100) / 100;
    expect(c.total()).toBeCloseTo(expected, 1);
  });

  it("total is minimum 0 even with large discounts", () => {
    const c = new Cart({ ...BASE, giftCardAmount: 999 });
    expect(c.total()).toBe(0);
  });

  it("rewardPointsValue = points * valuePerPoint", () => {
    const c = new Cart({ ...BASE, rewardPointsUsed: 100, rewardPointsValuePerPoint: 0.05 });
    expect(c.rewardPointsValue()).toBe(5.0);
  });

  it("totalDiscount sums all discount layers", () => {
    const c = new Cart({
      ...BASE,
      couponDiscount: 10,
      giftCardAmount: 5,
      walletAmount: 8,
      rewardPointsUsed: 100,
      rewardPointsValuePerPoint: 0.05,
    });
    // 10 + 5 + 8 + 5 = 28
    expect(c.totalDiscount()).toBe(28);
  });

  // ─── isEmpty / itemCount / guest ──────────────────────────────────────────

  it("isEmpty false when items present", () => {
    const c = new Cart(BASE);
    expect(c.isEmpty()).toBe(false);
  });

  it("isEmpty true when no items", () => {
    const c = new Cart({ ...BASE, items: [] });
    expect(c.isEmpty()).toBe(true);
  });

  it("itemCount sums quantities", () => {
    const c = new Cart({ ...BASE, items: [{ ...PHYSICAL_ITEM, quantity: 3 }, DIGITAL_ITEM] });
    expect(c.itemCount()).toBe(4);
  });

  it("isGuest true when no customerId", () => {
    const c = new Cart({ ...BASE, customerId: undefined, sessionId: "sess_abc" });
    expect(c.isGuest()).toBe(true);
  });

  it("isGuest false for member cart", () => {
    expect(new Cart(BASE).isGuest()).toBe(false);
  });

  // ─── hasDigitalItems / hasPhysicalItems ───────────────────────────────────

  it("hasDigitalItems true when digital item present", () => {
    const c = new Cart({ ...BASE, items: [PHYSICAL_ITEM, DIGITAL_ITEM] });
    expect(c.hasDigitalItems()).toBe(true);
  });

  it("hasPhysicalItems true when physical+shipping item present", () => {
    const c = new Cart(BASE);
    expect(c.hasPhysicalItems()).toBe(true);
  });

  it("hasPhysicalItems false for digital-only cart", () => {
    const c = new Cart({ ...BASE, items: [DIGITAL_ITEM] });
    expect(c.hasPhysicalItems()).toBe(false);
  });

  // ─── isExpired ────────────────────────────────────────────────────────────

  it("isExpired false when no expiresAt", () => {
    expect(new Cart(BASE).isExpired()).toBe(false);
  });

  it("isExpired true when expiresAt is past", () => {
    const c = new Cart({ ...BASE, expiresAt: new Date("2026-01-01") });
    expect(c.isExpired()).toBe(true);
  });

  it("isExpired false when expiresAt is future", () => {
    const c = new Cart({ ...BASE, expiresAt: new Date("2027-01-01") });
    expect(c.isExpired()).toBe(false);
  });

  // ─── addItem ──────────────────────────────────────────────────────────────

  it("addItem appends new item", () => {
    const c = new Cart(BASE);
    const c2 = c.addItem(DIGITAL_ITEM);
    expect(c2.items).toHaveLength(2);
    expect(c.items).toHaveLength(1); // immutable
  });

  it("addItem increments quantity for same productId+variantId", () => {
    const c = new Cart(BASE);
    const c2 = c.addItem({ ...PHYSICAL_ITEM, id: "ci99", quantity: 2 });
    expect(c2.items).toHaveLength(1);
    expect(c2.items[0].quantity).toBe(3);
  });

  it("addItem throws on quantity < 1", () => {
    const c = new Cart(BASE);
    expect(() => c.addItem({ ...DIGITAL_ITEM, quantity: 0 })).toThrow("quantity");
  });

  it("addItem throws on negative unit price", () => {
    const c = new Cart(BASE);
    expect(() => c.addItem({ ...DIGITAL_ITEM, unitPrice: -1 })).toThrow("negative");
  });

  // ─── removeItem ───────────────────────────────────────────────────────────

  it("removeItem removes matching item", () => {
    const c = new Cart({ ...BASE, items: [PHYSICAL_ITEM, DIGITAL_ITEM] });
    const c2 = c.removeItem("p1");
    expect(c2.items).toHaveLength(1);
    expect(c2.items[0].productId).toBe("p2");
  });

  it("removeItem is a no-op for non-existent item", () => {
    const c = new Cart(BASE);
    const c2 = c.removeItem("nope");
    expect(c2.items).toHaveLength(1);
  });

  // ─── updateQuantity ───────────────────────────────────────────────────────

  it("updateQuantity changes existing item quantity", () => {
    const c = new Cart(BASE);
    const c2 = c.updateQuantity("p1", 5);
    expect(c2.items[0].quantity).toBe(5);
  });

  it("updateQuantity throws on quantity < 1", () => {
    const c = new Cart(BASE);
    expect(() => c.updateQuantity("p1", 0)).toThrow("use removeItem");
  });

  it("updateQuantity throws on missing item", () => {
    const c = new Cart(BASE);
    expect(() => c.updateQuantity("nope", 2)).toThrow("not in cart");
  });

  // ─── Coupon ───────────────────────────────────────────────────────────────

  it("applyCoupon sets code and discount", () => {
    const c = new Cart(BASE);
    const c2 = c.applyCoupon("SAVE10", 10);
    expect(c2.couponCode).toBe("SAVE10");
    expect(c2.couponDiscount).toBe(10);
  });

  it("applyCoupon throws on empty code", () => {
    expect(() => new Cart(BASE).applyCoupon("", 5)).toThrow("required");
  });

  it("applyCoupon throws on negative discount", () => {
    expect(() => new Cart(BASE).applyCoupon("CODE", -5)).toThrow("negative");
  });

  it("applyCoupon throws when discount > subtotal", () => {
    expect(() => new Cart(BASE).applyCoupon("CODE", 999)).toThrow("exceeds subtotal");
  });

  it("removeCoupon clears coupon", () => {
    const c = new Cart({ ...BASE, couponCode: "SAVE10", couponDiscount: 10 });
    const c2 = c.removeCoupon();
    expect(c2.couponCode).toBeUndefined();
    expect(c2.couponDiscount).toBe(0);
  });

  // ─── Gift card / Wallet / Reward points ───────────────────────────────────

  it("applyGiftCard sets code and amount", () => {
    const c = new Cart(BASE);
    const c2 = c.applyGiftCard("GC-ABC123", 25);
    expect(c2.giftCardCode).toBe("GC-ABC123");
    expect(c2.giftCardAmount).toBe(25);
  });

  it("applyGiftCard throws on amount <= 0", () => {
    expect(() => new Cart(BASE).applyGiftCard("GC-X", 0)).toThrow("> 0");
  });

  it("applyWallet sets walletAmount", () => {
    const c = new Cart(BASE);
    expect(c.applyWallet(15).walletAmount).toBe(15);
  });

  it("applyWallet throws on amount <= 0", () => {
    expect(() => new Cart(BASE).applyWallet(0)).toThrow("> 0");
  });

  it("applyRewardPoints sets points and value", () => {
    const c = new Cart(BASE);
    const c2 = c.applyRewardPoints(200, 0.05);
    expect(c2.rewardPointsUsed).toBe(200);
    expect(c2.rewardPointsValue()).toBe(10);
  });

  it("applyRewardPoints throws on 0 points", () => {
    expect(() => new Cart(BASE).applyRewardPoints(0, 0.05)).toThrow("at least 1");
  });

  it("applyRewardPoints throws on valuePerPoint <= 0", () => {
    expect(() => new Cart(BASE).applyRewardPoints(100, 0)).toThrow("> 0");
  });

  // ─── clearDiscounts ───────────────────────────────────────────────────────

  it("clearDiscounts resets all discount fields", () => {
    const c = new Cart({
      ...BASE, couponCode: "X", couponDiscount: 10,
      giftCardCode: "GC", giftCardAmount: 5, walletAmount: 3, rewardPointsUsed: 50,
    });
    const c2 = c.clearDiscounts();
    expect(c2.totalDiscount()).toBe(0);
    expect(c2.couponCode).toBeUndefined();
  });

  // ─── toJSON ───────────────────────────────────────────────────────────────

  it("toJSON returns plain serialisable object", () => {
    const json = new Cart(BASE).toJSON();
    expect(json.id).toBe("cart_1");
    expect(Array.isArray(json.items)).toBe(true);
  });
});
