import { Bundle, BundleProps, BundleItem } from "@/domain/pricing/Bundle";

const ITEMS: BundleItem[] = [
  { id: "i1", type: "class",       name: "Yoga Class",    quantity: 10, usedCount: 0 },
  { id: "i2", type: "workshop",    name: "Workshop Pass", quantity: 2,  usedCount: 0 },
  { id: "i3", type: "consultation",name: "Consultation",  quantity: 1,  usedCount: 0 },
];

const base: BundleProps = {
  id: "b1",
  name: "10-Class + Workshop Bundle",
  slug: "10-class-workshop",
  type: "hybrid",
  description: "Mix of yoga classes and workshops",
  status: "active",
  items: ITEMS,
  basePrice: 199,
  discountedPrice: 169,
  currency: "CAD",
  expiryDays: 90,
  isMixAndMatch: false,
  isGiftable: true,
  isTransferable: true,
  notes: "",
  createdBy: "admin1",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("Bundle", () => {
  // --- Construction & validation ---
  it("creates valid bundle", () => {
    const b = new Bundle(base);
    expect(b.name).toBe("10-Class + Workshop Bundle");
    expect(b.type).toBe("hybrid");
    expect(b.status).toBe("active");
  });

  it("throws on blank name", () => {
    expect(() => new Bundle({ ...base, name: "  " })).toThrow("Bundle name required");
  });

  it("throws on blank slug", () => {
    expect(() => new Bundle({ ...base, slug: "" })).toThrow("Slug required");
  });

  it("throws on invalid slug (spaces)", () => {
    expect(() => new Bundle({ ...base, slug: "10 class bundle" })).toThrow("Slug must be lowercase kebab-case");
  });

  it("throws on negative basePrice", () => {
    expect(() => new Bundle({ ...base, basePrice: -1 })).toThrow("Base price cannot be negative");
  });

  it("throws when discountedPrice > basePrice", () => {
    expect(() => new Bundle({ ...base, discountedPrice: 250 })).toThrow("Discounted price cannot exceed base price");
  });

  it("throws when expiryDays < 1", () => {
    expect(() => new Bundle({ ...base, expiryDays: 0 })).toThrow("Expiry must be at least 1 day");
  });

  it("throws when item quantity < 1", () => {
    expect(() => new Bundle({ ...base, items: [{ id: "x", type: "class", name: "X", quantity: 0, usedCount: 0 }] })).toThrow("Item quantity must be >= 1");
  });

  it("throws when usedCount > quantity", () => {
    expect(() => new Bundle({ ...base, items: [{ id: "x", type: "class", name: "X", quantity: 5, usedCount: 6 }] })).toThrow("Used count cannot exceed quantity");
  });

  // --- Aggregations ---
  it("totalItems — sums all quantities", () => {
    expect(new Bundle(base).totalItems()).toBe(13); // 10+2+1
  });

  it("totalUsed — 0 initially", () => {
    expect(new Bundle(base).totalUsed()).toBe(0);
  });

  it("totalRemaining — equals totalItems initially", () => {
    expect(new Bundle(base).totalRemaining()).toBe(13);
  });

  it("remainingCredits — per item type", () => {
    expect(new Bundle(base).remainingCredits("class")).toBe(10);
    expect(new Bundle(base).remainingCredits("workshop")).toBe(2);
    expect(new Bundle(base).remainingCredits("consultation")).toBe(1);
    expect(new Bundle(base).remainingCredits("retreat")).toBe(0);
  });

  it("discountPercent — 15% off (199 → 169)", () => {
    expect(new Bundle(base).discountPercent()).toBe(15);
  });

  it("discountPercent — 0% when no discount", () => {
    expect(new Bundle({ ...base, discountedPrice: 199 }).discountPercent()).toBe(0);
  });

  // --- Activation ---
  it("isActivated — false before activation", () => {
    expect(new Bundle(base).isActivated()).toBe(false);
  });

  it("activate — sets activatedAt and calculates expiresAt", () => {
    const activateAt = new Date("2026-09-01T00:00:00Z");
    const b = new Bundle({ ...base, customerId: undefined }).activate("cust_01", activateAt);
    expect(b.isActivated()).toBe(true);
    expect(b.activatedAt?.toISOString()).toBe(activateAt.toISOString());
    const expectedExpiry = new Date("2026-11-30T00:00:00Z"); // +90 days
    expect(b.expiresAt?.toISOString()).toBe(expectedExpiry.toISOString());
  });

  it("activate — throws if already activated", () => {
    const b = new Bundle(base).activate("cust_01", new Date("2026-09-01T00:00:00Z"));
    expect(() => b.activate("cust_02")).toThrow("Bundle already activated");
  });

  it("activate — throws without customerId", () => {
    expect(() => new Bundle(base).activate("  ")).toThrow("Customer ID required to activate");
  });

  // --- isExpired ---
  it("isExpired — false before activation", () => {
    expect(new Bundle(base).isExpired()).toBe(false);
  });

  it("isExpired — false within validity", () => {
    const b = new Bundle(base).activate("cust_01", new Date("2026-09-01T00:00:00Z"));
    expect(b.isExpired(new Date("2026-09-15T00:00:00Z"))).toBe(false);
  });

  it("isExpired — true after expiry", () => {
    const b = new Bundle(base).activate("cust_01", new Date("2026-09-01T00:00:00Z"));
    expect(b.isExpired(new Date("2027-01-01T00:00:00Z"))).toBe(true);
  });

  // --- useItem ---
  it("useItem — reduces item usedCount", () => {
    const b = new Bundle(base).useItem("i1", 3);
    expect(b.remainingCredits("class")).toBe(7);
    expect(b.totalUsed()).toBe(3);
  });

  it("useItem — throws when insufficient credits", () => {
    expect(() => new Bundle(base).useItem("i1", 11)).toThrow("Insufficient class credits");
  });

  it("useItem — throws when item not found", () => {
    expect(() => new Bundle(base).useItem("nonexistent")).toThrow("Item nonexistent not found");
  });

  it("useItem — defaults count to 1", () => {
    const b = new Bundle(base).useItem("i2");
    expect(b.remainingCredits("workshop")).toBe(1);
  });

  // --- Gift ---
  it("gift — sets giftedTo and purchasedBy", () => {
    const b = new Bundle(base).gift("cust_02", "cust_01");
    expect(b.giftedTo).toBe("cust_02");
  });

  it("gift — throws if not giftable", () => {
    expect(() => new Bundle({ ...base, isGiftable: false }).gift("c2", "c1")).toThrow("not giftable");
  });

  it("gift — throws if already gifted", () => {
    const b = new Bundle(base).gift("c2", "c1");
    expect(() => b.gift("c3", "c1")).toThrow("Bundle already gifted");
  });

  // --- Transfer ---
  it("transfer — sets transferredTo and updates customerId", () => {
    const b = new Bundle({ ...base, customerId: "cust_01" }).transfer("cust_02");
    expect(b.transferredTo).toBe("cust_02");
    expect(b.customerId).toBe("cust_02");
    expect(b.transferredAt).toBeDefined();
  });

  it("transfer — throws if not transferable", () => {
    expect(() => new Bundle({ ...base, isTransferable: false }).transfer("c2")).toThrow("not transferable");
  });

  it("transfer — throws if already transferred", () => {
    const b = new Bundle({ ...base, customerId: "c1" }).transfer("c2");
    expect(() => b.transfer("c3")).toThrow("Bundle already transferred");
  });

  // --- State machine ---
  it("suspend — active → suspended", () => {
    expect(new Bundle(base).suspend("Fraud check").status).toBe("suspended");
  });

  it("suspend — throws without reason", () => {
    expect(() => new Bundle(base).suspend("  ")).toThrow("Suspension reason required");
  });

  it("reinstate — suspended → active", () => {
    expect(new Bundle(base).suspend("Fraud check").reinstate().status).toBe("active");
  });

  it("archive — sets archived status", () => {
    expect(new Bundle(base).archive().status).toBe("archived");
  });

  it("archive — throws if already archived", () => {
    expect(() => new Bundle({ ...base, status: "archived" }).archive()).toThrow("Already archived");
  });

  // --- Immutability ---
  it("immutable — useItem does not modify original", () => {
    const b = new Bundle(base);
    b.useItem("i1", 5);
    expect(b.remainingCredits("class")).toBe(10);
  });
});
