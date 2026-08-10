import { Order, OrderProps, OrderItem } from "@/domain/ecommerce/Order";

const BASE_ITEM: OrderItem = {
  id: "i1", productId: "p1", productName: "Yoga Mat", productType: "physical",
  sku: "YM-001", quantity: 1, unitPrice: 69.99, discountAmount: 0,
  taxAmount: 9.1, totalAmount: 79.09, isDigital: false,
};

const DIGITAL_ITEM: OrderItem = {
  id: "i2", productId: "p2", productName: "Yoga Course", productType: "digital",
  sku: "COURSE-001", quantity: 1, unitPrice: 49.99, discountAmount: 0,
  taxAmount: 0, totalAmount: 49.99, isDigital: true, downloadUrl: "https://cdn.example.com/course",
};

const BASE: OrderProps = {
  id: "o1", orderNumber: "ORD-20260801-001",
  customerId: "cust_1", customerEmail: "alice@example.com",
  status: "pending", paymentStatus: "paid", fulfillmentStatus: "unfulfilled",
  items: [BASE_ITEM],
  subtotal: 69.99, discountAmount: 0, couponDiscount: 0, giftCardAmount: 0,
  walletAmount: 0, rewardPointsUsed: 0, rewardPointsValue: 0,
  taxAmount: 9.1, shippingAmount: 5.0, total: 84.09, currency: "CAD",
  refundAmount: 0,
  metadata: {},
  createdAt: new Date("2026-08-01"), updatedAt: new Date("2026-08-01"),
};

describe("Order", () => {
  // ─── Constructor validation ───────────────────────────────────────────────

  it("creates valid order", () => {
    const o = new Order(BASE);
    expect(o.orderNumber).toBe("ORD-20260801-001");
    expect(o.status).toBe("pending");
    expect(o.total).toBe(84.09);
  });

  it("throws on empty order number", () => {
    expect(() => new Order({ ...BASE, orderNumber: "  " })).toThrow("Order number required");
  });

  it("throws on empty customer email", () => {
    expect(() => new Order({ ...BASE, customerEmail: "" })).toThrow("Customer email required");
  });

  it("throws on empty items array", () => {
    expect(() => new Order({ ...BASE, items: [] })).toThrow("at least one item");
  });

  it("throws on negative subtotal", () => {
    expect(() => new Order({ ...BASE, subtotal: -1 })).toThrow("negative");
  });

  it("throws on negative total", () => {
    expect(() => new Order({ ...BASE, total: -1 })).toThrow("negative");
  });

  it("throws on negative tax amount", () => {
    expect(() => new Order({ ...BASE, taxAmount: -1 })).toThrow("negative");
  });

  it("throws on negative shipping amount", () => {
    expect(() => new Order({ ...BASE, shippingAmount: -1 })).toThrow("negative");
  });

  it("throws when refund exceeds total", () => {
    expect(() => new Order({ ...BASE, refundAmount: 100 })).toThrow("exceed");
  });

  it("throws on item with quantity < 1", () => {
    expect(() => new Order({ ...BASE, items: [{ ...BASE_ITEM, quantity: 0 }] })).toThrow("quantity");
  });

  it("throws on item with negative unit price", () => {
    expect(() => new Order({ ...BASE, items: [{ ...BASE_ITEM, unitPrice: -1 }] })).toThrow("negative");
  });

  // ─── Getters ──────────────────────────────────────────────────────────────

  it("returns defensive copy of items", () => {
    const o = new Order(BASE);
    const items = o.items;
    items[0].unitPrice = 999;
    expect(o.items[0].unitPrice).toBe(69.99);
  });

  it("supports guest order (no customerId)", () => {
    const o = new Order({ ...BASE, customerId: undefined });
    expect(o.customerId).toBeUndefined();
  });

  // ─── itemCount / digital / physical ──────────────────────────────────────

  it("itemCount sums quantities", () => {
    const o = new Order({ ...BASE, items: [{ ...BASE_ITEM, quantity: 2 }, DIGITAL_ITEM] });
    expect(o.itemCount()).toBe(3);
  });

  it("hasDigitalItems detects digital", () => {
    const o = new Order({ ...BASE, items: [BASE_ITEM, DIGITAL_ITEM] });
    expect(o.hasDigitalItems()).toBe(true);
  });

  it("hasPhysicalItems detects physical", () => {
    const o = new Order(BASE);
    expect(o.hasPhysicalItems()).toBe(true);
  });

  it("digital-only order has no physical items", () => {
    const o = new Order({ ...BASE, items: [DIGITAL_ITEM] });
    expect(o.hasPhysicalItems()).toBe(false);
  });

  // ─── getItem ──────────────────────────────────────────────────────────────

  it("getItem returns item by id", () => {
    const o = new Order(BASE);
    expect(o.getItem("i1")).toBeDefined();
  });

  it("getItem returns undefined for unknown id", () => {
    const o = new Order(BASE);
    expect(o.getItem("nope")).toBeUndefined();
  });

  // ─── Status machine ───────────────────────────────────────────────────────

  it("confirm: pending → confirmed", () => {
    const o = new Order(BASE);
    expect(o.confirm().status).toBe("confirmed");
  });

  it("confirm throws from non-pending", () => {
    const o = new Order({ ...BASE, status: "confirmed" });
    expect(() => o.confirm()).toThrow("Cannot confirm from confirmed");
  });

  it("startProcessing: confirmed → processing", () => {
    const o = new Order({ ...BASE, status: "confirmed" });
    expect(o.startProcessing().status).toBe("processing");
  });

  it("startProcessing throws from pending", () => {
    const o = new Order(BASE);
    expect(() => o.startProcessing()).toThrow("process from pending");
  });

  it("ship: processing → shipped + tracking", () => {
    const o = new Order({ ...BASE, status: "processing" });
    const shipped = o.ship("1Z999AA10123456784", "https://track.example.com");
    expect(shipped.status).toBe("shipped");
    expect(shipped.trackingNumber).toBe("1Z999AA10123456784");
    expect(shipped.fulfillmentStatus).toBe("fulfilled");
  });

  it("ship throws without tracking number", () => {
    const o = new Order({ ...BASE, status: "processing" });
    expect(() => o.ship("  ")).toThrow("Tracking number required");
  });

  it("ship throws from non-processing/confirmed", () => {
    const o = new Order({ ...BASE, status: "pending" });
    expect(() => o.ship("TRK123")).toThrow("Cannot ship from pending");
  });

  it("deliver: shipped → delivered", () => {
    const o = new Order({ ...BASE, status: "shipped" });
    expect(o.deliver().status).toBe("delivered");
  });

  it("deliver throws from non-shipped", () => {
    const o = new Order({ ...BASE, status: "processing" });
    expect(() => o.deliver()).toThrow("Cannot deliver from processing");
  });

  it("cancel: pending → cancelled with reason", () => {
    const o = new Order(BASE);
    const cancelled = o.cancel("Customer requested");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelReason).toBe("Customer requested");
  });

  it("cancel throws without reason", () => {
    expect(() => new Order(BASE).cancel("")).toThrow("reason required");
  });

  it("cancel throws on delivered order", () => {
    const o = new Order({ ...BASE, status: "delivered" });
    expect(() => o.cancel("test")).toThrow("Cannot cancel a delivered order");
  });

  it("cancel throws on refunded order", () => {
    const o = new Order({ ...BASE, status: "refunded" });
    expect(() => o.cancel("test")).toThrow("Cannot cancel a refunded order");
  });

  // ─── Refund ───────────────────────────────────────────────────────────────

  it("full refund sets status=refunded and paymentStatus=refunded", () => {
    const o = new Order({ ...BASE, status: "delivered" });
    const refunded = o.refund(84.09, "Customer unsatisfied");
    expect(refunded.status).toBe("refunded");
    expect(refunded.paymentStatus).toBe("refunded");
    expect(refunded.refundAmount).toBe(84.09);
  });

  it("partial refund keeps status=delivered", () => {
    const o = new Order({ ...BASE, status: "delivered" });
    const refunded = o.refund(20, "Partial refund");
    expect(refunded.status).toBe("delivered");
    expect(refunded.paymentStatus).toBe("partially_paid");
  });

  it("refund throws on amount = 0", () => {
    const o = new Order({ ...BASE, status: "delivered" });
    expect(() => o.refund(0, "test")).toThrow("> 0");
  });

  it("refund throws when amount > total", () => {
    const o = new Order({ ...BASE, status: "delivered" });
    expect(() => o.refund(999, "test")).toThrow("exceed");
  });

  it("refund throws without reason", () => {
    const o = new Order({ ...BASE, status: "delivered" });
    expect(() => o.refund(10, "")).toThrow("reason required");
  });

  it("refund throws from non-delivered/cancelled/returned", () => {
    const o = new Order({ ...BASE, status: "processing" });
    expect(() => o.refund(10, "test")).toThrow("Cannot refund from processing");
  });

  // ─── Return ───────────────────────────────────────────────────────────────

  it("requestReturn from delivered", () => {
    const o = new Order({ ...BASE, status: "delivered" });
    const returned = o.requestReturn("Defective product");
    expect(returned.status).toBe("returned");
    expect(returned.fulfillmentStatus).toBe("returned");
  });

  it("requestReturn throws from non-delivered", () => {
    const o = new Order({ ...BASE, status: "shipped" });
    expect(() => o.requestReturn("test")).toThrow("only return delivered");
  });

  it("requestReturn throws without reason", () => {
    const o = new Order({ ...BASE, status: "delivered" });
    expect(() => o.requestReturn("")).toThrow("reason required");
  });

  // ─── Payment ──────────────────────────────────────────────────────────────

  it("markPaid sets paymentStatus=paid", () => {
    const o = new Order({ ...BASE, paymentStatus: "pending" });
    expect(o.markPaid().paymentStatus).toBe("paid");
  });

  it("markPaid throws if already paid", () => {
    const o = new Order(BASE);
    expect(() => o.markPaid()).toThrow("Already paid");
  });

  it("markPaymentFailed sets paymentStatus=failed", () => {
    const o = new Order({ ...BASE, paymentStatus: "pending" });
    expect(o.markPaymentFailed().paymentStatus).toBe("failed");
  });

  it("setInvoiceNumber sets invoice number", () => {
    const o = new Order(BASE);
    const invoiced = o.setInvoiceNumber("INV-2026-001");
    expect(invoiced.invoiceNumber).toBe("INV-2026-001");
  });

  it("setInvoiceNumber throws on empty string", () => {
    const o = new Order(BASE);
    expect(() => o.setInvoiceNumber("  ")).toThrow("required");
  });

  // ─── toJSON ───────────────────────────────────────────────────────────────

  it("toJSON returns serialisable object", () => {
    const o = new Order(BASE);
    const json = o.toJSON();
    expect(json.orderNumber).toBe("ORD-20260801-001");
    expect(Array.isArray(json.items)).toBe(true);
  });
});
