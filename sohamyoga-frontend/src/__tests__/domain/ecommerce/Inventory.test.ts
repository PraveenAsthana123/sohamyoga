import { Inventory, InventoryProps } from "@/domain/ecommerce/Inventory";

const BASE: InventoryProps = {
  id: "inv1", productId: "p1", warehouseId: "wh-toronto",
  warehouseName: "Toronto Main Warehouse", sku: "YM-001",
  quantity: 50, reservedQuantity: 5,
  reorderPoint: 10, reorderQuantity: 100,
  location: "A-3-7", movements: [],
  updatedAt: new Date("2026-08-01"),
};

describe("Inventory", () => {
  // ─── Constructor validation ───────────────────────────────────────────────

  it("creates valid inventory", () => {
    const inv = new Inventory(BASE);
    expect(inv.sku).toBe("YM-001");
    expect(inv.quantity).toBe(50);
    expect(inv.reservedQuantity).toBe(5);
  });

  it("throws on empty SKU", () => {
    expect(() => new Inventory({ ...BASE, sku: "" })).toThrow("SKU required");
  });

  it("throws on empty productId", () => {
    expect(() => new Inventory({ ...BASE, productId: "" })).toThrow("Product ID required");
  });

  it("throws on empty warehouseId", () => {
    expect(() => new Inventory({ ...BASE, warehouseId: "" })).toThrow("Warehouse ID required");
  });

  it("throws on negative quantity", () => {
    expect(() => new Inventory({ ...BASE, quantity: -1 })).toThrow("negative");
  });

  it("throws on negative reservedQuantity", () => {
    expect(() => new Inventory({ ...BASE, reservedQuantity: -1 })).toThrow("negative");
  });

  it("throws when reservedQuantity > quantity", () => {
    expect(() => new Inventory({ ...BASE, quantity: 5, reservedQuantity: 10 })).toThrow("Reserved cannot exceed");
  });

  it("throws on negative reorderPoint", () => {
    expect(() => new Inventory({ ...BASE, reorderPoint: -1 })).toThrow("negative");
  });

  it("throws on reorderQuantity < 1", () => {
    expect(() => new Inventory({ ...BASE, reorderQuantity: 0 })).toThrow(">= 1");
  });

  // ─── availableQty ─────────────────────────────────────────────────────────

  it("availableQty = quantity - reservedQuantity", () => {
    expect(new Inventory(BASE).availableQty()).toBe(45);
  });

  it("availableQty = 0 when all reserved", () => {
    const inv = new Inventory({ ...BASE, quantity: 5, reservedQuantity: 5 });
    expect(inv.availableQty()).toBe(0);
  });

  // ─── isLowStock / isOutOfStock / status ───────────────────────────────────

  it("isLowStock true when availableQty <= reorderPoint and > 0", () => {
    const inv = new Inventory({ ...BASE, quantity: 15, reservedQuantity: 6, reorderPoint: 10 });
    // available = 9 <= 10 and > 0 → low_stock
    expect(inv.isLowStock()).toBe(true);
    expect(inv.status()).toBe("low_stock");
  });

  it("isLowStock false when stock is adequate", () => {
    expect(new Inventory(BASE).isLowStock()).toBe(false);
    expect(new Inventory(BASE).status()).toBe("in_stock");
  });

  it("isOutOfStock true when availableQty = 0", () => {
    const inv = new Inventory({ ...BASE, quantity: 5, reservedQuantity: 5 });
    expect(inv.isOutOfStock()).toBe(true);
    expect(inv.status()).toBe("out_of_stock");
  });

  // ─── isExpired ────────────────────────────────────────────────────────────

  it("isExpired false when no expiryDate", () => {
    expect(new Inventory(BASE).isExpired()).toBe(false);
  });

  it("isExpired true when expiryDate is past", () => {
    const inv = new Inventory({ ...BASE, expiryDate: new Date("2026-01-01") });
    expect(inv.isExpired()).toBe(true);
  });

  it("isExpired false when expiryDate is future", () => {
    const inv = new Inventory({ ...BASE, expiryDate: new Date("2027-01-01") });
    expect(inv.isExpired()).toBe(false);
  });

  // ─── reserve ──────────────────────────────────────────────────────────────

  it("reserve increases reservedQuantity", () => {
    const inv = new Inventory(BASE);
    const inv2 = inv.reserve(10, "order-123", "system");
    expect(inv2.reservedQuantity).toBe(15);
    expect(inv2.availableQty()).toBe(35);
  });

  it("reserve records movement", () => {
    const inv = new Inventory({ ...BASE, movements: [] });
    const inv2 = inv.reserve(5, "order-x", "system");
    expect(inv2.movements).toHaveLength(1);
    expect(inv2.movements[0].type).toBe("reservation");
    expect(inv2.movements[0].quantity).toBe(5);
  });

  it("reserve throws on insufficient stock", () => {
    const inv = new Inventory(BASE);
    // availableQty = 45; can't reserve 50
    expect(() => inv.reserve(50, "order-x", "system")).toThrow("Insufficient stock");
  });

  it("reserve throws on qty < 1", () => {
    expect(() => new Inventory(BASE).reserve(0, "x", "admin")).toThrow(">= 1");
  });

  // ─── release ──────────────────────────────────────────────────────────────

  it("release decreases reservedQuantity", () => {
    const inv = new Inventory(BASE); // reserved = 5
    const inv2 = inv.release(3, "order-123", "system");
    expect(inv2.reservedQuantity).toBe(2);
  });

  it("release records release movement", () => {
    const inv = new Inventory(BASE);
    const inv2 = inv.release(2, "order-x", "system");
    expect(inv2.movements[0].type).toBe("release");
  });

  it("release throws when releasing more than reserved", () => {
    const inv = new Inventory(BASE); // reserved = 5
    expect(() => inv.release(10, "x", "admin")).toThrow("Cannot release");
  });

  it("release throws on qty < 1", () => {
    expect(() => new Inventory(BASE).release(0, "x", "admin")).toThrow(">= 1");
  });

  // ─── commit ───────────────────────────────────────────────────────────────

  it("commit reduces both quantity and reservedQuantity", () => {
    const inv = new Inventory(BASE); // qty=50, reserved=5
    const inv2 = inv.commit(3, "order-123", "system");
    expect(inv2.quantity).toBe(47);
    expect(inv2.reservedQuantity).toBe(2);
  });

  it("commit records sale movement with negative qty", () => {
    const inv = new Inventory(BASE);
    const inv2 = inv.commit(2, "order-123", "system");
    expect(inv2.movements[0].type).toBe("sale");
    expect(inv2.movements[0].quantity).toBe(-2);
  });

  it("commit throws when more than reserved", () => {
    const inv = new Inventory(BASE);
    expect(() => inv.commit(10, "order-x", "admin")).toThrow("Cannot commit");
  });

  // ─── receive ──────────────────────────────────────────────────────────────

  it("receive increases quantity", () => {
    const inv = new Inventory(BASE);
    const inv2 = inv.receive(50, "admin", { referenceId: "PO-001" });
    expect(inv2.quantity).toBe(100);
  });

  it("receive records receipt movement", () => {
    const inv = new Inventory(BASE);
    const inv2 = inv.receive(20, "staff", { batchNumber: "BATCH-2026-07" });
    expect(inv2.movements[0].type).toBe("receipt");
    expect(inv2.movements[0].batchNumber).toBe("BATCH-2026-07");
  });

  it("receive throws on qty < 1", () => {
    expect(() => new Inventory(BASE).receive(0, "admin")).toThrow(">= 1");
  });

  // ─── adjust ───────────────────────────────────────────────────────────────

  it("adjust with positive qty increases stock", () => {
    const inv = new Inventory(BASE);
    const inv2 = inv.adjust(10, "Found extra stock", "admin");
    expect(inv2.quantity).toBe(60);
  });

  it("adjust with negative qty decreases stock", () => {
    const inv = new Inventory(BASE);
    const inv2 = inv.adjust(-20, "Damaged goods", "admin");
    expect(inv2.quantity).toBe(30);
  });

  it("adjust records adjustment movement", () => {
    const inv = new Inventory(BASE);
    const inv2 = inv.adjust(5, "Cycle count correction", "admin");
    expect(inv2.movements[0].type).toBe("adjustment");
    expect(inv2.movements[0].reason).toBe("Cycle count correction");
  });

  it("adjust throws on zero qty", () => {
    expect(() => new Inventory(BASE).adjust(0, "test", "admin")).toThrow("cannot be zero");
  });

  it("adjust throws on empty reason", () => {
    expect(() => new Inventory(BASE).adjust(5, "", "admin")).toThrow("required");
  });

  it("adjust throws when result would be negative", () => {
    const inv = new Inventory(BASE); // qty=50
    expect(() => inv.adjust(-100, "test", "admin")).toThrow("negative stock");
  });

  it("adjust throws when result < reservedQuantity", () => {
    const inv = new Inventory(BASE); // qty=50, reserved=5
    // Reduce to 4 (below reserved of 5)
    expect(() => inv.adjust(-46, "test", "admin")).toThrow("less than reserved");
  });

  // ─── markExpired ──────────────────────────────────────────────────────────

  it("markExpired reduces quantity and records expired movement", () => {
    const inv = new Inventory(BASE);
    const inv2 = inv.markExpired(5, "admin", "BATCH-2025-12");
    expect(inv2.quantity).toBe(45);
    expect(inv2.movements[0].type).toBe("expired");
    expect(inv2.movements[0].quantity).toBe(-5);
  });

  it("markExpired throws on qty < 1", () => {
    expect(() => new Inventory(BASE).markExpired(0, "admin")).toThrow(">= 1");
  });

  it("markExpired throws when exceeds availableQty", () => {
    const inv = new Inventory(BASE); // available=45
    expect(() => inv.markExpired(50, "admin")).toThrow("available stock");
  });

  // ─── addReturn ────────────────────────────────────────────────────────────

  it("addReturn increases quantity and records return movement", () => {
    const inv = new Inventory(BASE);
    const inv2 = inv.addReturn(2, "order-123", "staff");
    expect(inv2.quantity).toBe(52);
    expect(inv2.movements[0].type).toBe("return");
  });

  it("addReturn throws on qty < 1", () => {
    expect(() => new Inventory(BASE).addReturn(0, "order-x", "staff")).toThrow(">= 1");
  });

  // ─── toJSON / defensive copy ──────────────────────────────────────────────

  it("movements returns defensive copy", () => {
    const inv = new Inventory(BASE);
    const movs = inv.movements;
    movs.push({ id: "x", type: "receipt", quantity: 1, warehouseId: "w", performedBy: "x", performedAt: new Date() });
    expect(inv.movements).toHaveLength(0);
  });

  it("toJSON returns serialisable object", () => {
    const json = new Inventory(BASE).toJSON();
    expect(json.sku).toBe("YM-001");
  });
});
