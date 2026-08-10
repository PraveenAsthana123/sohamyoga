import { Product, ProductProps, ProductVariant } from "@/domain/ecommerce/Product";

const BASE_VARIANT: ProductVariant = {
  id: "v1", sku: "YM-S-BLU", name: "Small / Blue",
  attributes: { size: "S", color: "Blue" },
  price: 59.99, stock: 20, lowStockThreshold: 3, isActive: true,
};

const BASE: ProductProps = {
  id: "p1", name: "Premium Yoga Mat", slug: "premium-yoga-mat",
  type: "physical", status: "active",
  description: "Eco-friendly yoga mat", shortDescription: "Best mat",
  basePrice: 69.99, compareAtPrice: 89.99, currency: "CAD",
  sku: "YM-001", trackInventory: true, stock: 50, lowStockThreshold: 5,
  requiresShipping: true, taxable: true, taxClass: "standard",
  categories: ["yoga-equipment"], tags: ["mat", "eco"],
  variants: [BASE_VARIANT], images: [],
  isGiftable: true, isSubscriptionProduct: false,
  averageRating: 4.5, reviewCount: 12,
  createdBy: "admin", createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
};

describe("Product", () => {
  // ─── Constructor validation ───────────────────────────────────────────────

  it("creates valid product", () => {
    const p = new Product(BASE);
    expect(p.name).toBe("Premium Yoga Mat");
    expect(p.type).toBe("physical");
    expect(p.basePrice).toBe(69.99);
  });

  it("throws on empty name", () => {
    expect(() => new Product({ ...BASE, name: "  " })).toThrow("name required");
  });

  it("throws on empty slug", () => {
    expect(() => new Product({ ...BASE, slug: "" })).toThrow("Slug required");
  });

  it("throws on invalid slug (uppercase)", () => {
    expect(() => new Product({ ...BASE, slug: "Yoga-Mat" })).toThrow("lowercase kebab-case");
  });

  it("throws on empty SKU", () => {
    expect(() => new Product({ ...BASE, sku: "" })).toThrow("SKU required");
  });

  it("throws on negative base price", () => {
    expect(() => new Product({ ...BASE, basePrice: -1 })).toThrow("negative");
  });

  it("throws when compareAtPrice < basePrice", () => {
    expect(() => new Product({ ...BASE, compareAtPrice: 50 })).toThrow(">= base price");
  });

  it("throws on negative stock", () => {
    expect(() => new Product({ ...BASE, stock: -1 })).toThrow("negative");
  });

  it("throws on rating > 5", () => {
    expect(() => new Product({ ...BASE, averageRating: 6 })).toThrow("0–5");
  });

  it("throws on variant with negative price", () => {
    expect(() => new Product({ ...BASE, variants: [{ ...BASE_VARIANT, price: -5 }] })).toThrow("negative");
  });

  it("throws on variant with negative stock", () => {
    expect(() => new Product({ ...BASE, variants: [{ ...BASE_VARIANT, stock: -1 }] })).toThrow("negative");
  });

  it("throws on downloadLimit < 1", () => {
    expect(() => new Product({ ...BASE, downloadLimit: 0 })).toThrow(">= 1");
  });

  it("throws on maxParticipants < 1", () => {
    expect(() => new Product({ ...BASE, maxParticipants: 0 })).toThrow(">= 1");
  });

  // ─── Getters ──────────────────────────────────────────────────────────────

  it("returns defensive copies of categories and tags", () => {
    const p = new Product(BASE);
    const cats = p.categories;
    cats.push("hacked");
    expect(p.categories).toHaveLength(1);
  });

  it("returns defensive copy of variants", () => {
    const p = new Product(BASE);
    const variants = p.variants;
    variants[0].price = 999;
    expect(p.variants[0].price).toBe(59.99);
  });

  // ─── discountPercent ──────────────────────────────────────────────────────

  it("calculates discount percent correctly", () => {
    const p = new Product(BASE);
    // (89.99 - 69.99) / 89.99 * 100 ≈ 22%
    expect(p.discountPercent()).toBe(22);
  });

  it("returns 0 when no compareAtPrice", () => {
    const p = new Product({ ...BASE, compareAtPrice: undefined });
    expect(p.discountPercent()).toBe(0);
  });

  // ─── Stock queries ────────────────────────────────────────────────────────

  it("isInStock returns true when stock > 0 and trackInventory", () => {
    const p = new Product(BASE);
    expect(p.isInStock()).toBe(true);
  });

  it("isInStock returns false when stock = 0", () => {
    const p = new Product({ ...BASE, stock: 0 });
    expect(p.isInStock()).toBe(false);
  });

  it("isLowStock returns true when stock <= threshold", () => {
    const p = new Product({ ...BASE, stock: 3, lowStockThreshold: 5 });
    expect(p.isLowStock()).toBe(true);
  });

  it("isLowStock returns false when stock = 0 (out of stock, not low)", () => {
    const p = new Product({ ...BASE, stock: 0 });
    expect(p.isLowStock()).toBe(false);
  });

  it("isInStock by variant ID", () => {
    const p = new Product(BASE);
    expect(p.isInStock("v1")).toBe(true);
    expect(p.isInStock("nonexistent")).toBe(false);
  });

  // ─── getVariant ───────────────────────────────────────────────────────────

  it("getVariant returns defensive copy", () => {
    const p = new Product(BASE);
    const v = p.getVariant("v1");
    expect(v).toBeDefined();
    expect(v!.price).toBe(59.99);
  });

  it("getVariant returns undefined for missing ID", () => {
    const p = new Product(BASE);
    expect(p.getVariant("nope")).toBeUndefined();
  });

  // ─── addVariant ───────────────────────────────────────────────────────────

  it("addVariant adds a new variant", () => {
    const p = new Product({ ...BASE, variants: [] });
    const p2 = p.addVariant(BASE_VARIANT);
    expect(p2.variants).toHaveLength(1);
    expect(p.variants).toHaveLength(0); // immutable
  });

  it("addVariant throws on duplicate ID", () => {
    const p = new Product(BASE);
    expect(() => p.addVariant(BASE_VARIANT)).toThrow("already exists");
  });

  it("addVariant throws on duplicate SKU", () => {
    const p = new Product(BASE);
    expect(() => p.addVariant({ ...BASE_VARIANT, id: "v99" })).toThrow("SKU");
  });

  // ─── removeVariant ────────────────────────────────────────────────────────

  it("removeVariant removes existing variant", () => {
    const p = new Product(BASE);
    const p2 = p.removeVariant("v1");
    expect(p2.variants).toHaveLength(0);
  });

  it("removeVariant throws on missing ID", () => {
    const p = new Product(BASE);
    expect(() => p.removeVariant("nope")).toThrow("not found");
  });

  // ─── updateStock ──────────────────────────────────────────────────────────

  it("updateStock sets stock to 0 and changes status to out_of_stock", () => {
    const p = new Product(BASE);
    const p2 = p.updateStock(0);
    expect(p2.stock).toBe(0);
    expect(p2.status).toBe("out_of_stock");
  });

  it("updateStock restores from out_of_stock to active", () => {
    const p = new Product({ ...BASE, status: "out_of_stock", stock: 0 });
    const p2 = p.updateStock(10);
    expect(p2.status).toBe("active");
  });

  it("updateStock throws on negative", () => {
    const p = new Product(BASE);
    expect(() => p.updateStock(-5)).toThrow("negative");
  });

  // ─── Category / tag management ────────────────────────────────────────────

  it("addCategory appends unique category", () => {
    const p = new Product(BASE);
    const p2 = p.addCategory("meditation");
    expect(p2.categories).toContain("meditation");
  });

  it("addCategory is idempotent", () => {
    const p = new Product(BASE);
    const p2 = p.addCategory("yoga-equipment");
    expect(p2.categories).toHaveLength(1);
  });

  it("removeCategory removes existing category", () => {
    const p = new Product(BASE);
    const p2 = p.removeCategory("yoga-equipment");
    expect(p2.categories).toHaveLength(0);
  });

  it("addTag appends unique tag", () => {
    const p = new Product(BASE);
    const p2 = p.addTag("organic");
    expect(p2.tags).toContain("organic");
  });

  // ─── State machine ────────────────────────────────────────────────────────

  it("activate from draft", () => {
    const p = new Product({ ...BASE, status: "draft" });
    expect(p.activate().status).toBe("active");
  });

  it("activate throws on archived", () => {
    const p = new Product({ ...BASE, status: "archived" });
    expect(() => p.activate()).toThrow("archived");
  });

  it("archive from active", () => {
    const p = new Product(BASE);
    expect(p.archive().status).toBe("archived");
  });

  it("archive throws if already archived", () => {
    const p = new Product({ ...BASE, status: "archived" });
    expect(() => p.archive()).toThrow("Already archived");
  });

  it("markOutOfStock from active", () => {
    const p = new Product(BASE);
    const p2 = p.markOutOfStock();
    expect(p2.status).toBe("out_of_stock");
    expect(p2.stock).toBe(0);
  });

  it("markOutOfStock throws on archived", () => {
    const p = new Product({ ...BASE, status: "archived" });
    expect(() => p.markOutOfStock()).toThrow("Archived products");
  });

  // ─── Reviews ──────────────────────────────────────────────────────────────

  it("addReview updates averageRating and reviewCount", () => {
    const p = new Product({ ...BASE, averageRating: 4, reviewCount: 1 });
    const p2 = p.addReview(5);
    expect(p2.reviewCount).toBe(2);
    expect(p2.averageRating).toBe(4.5);
  });

  it("addReview throws on rating out of range", () => {
    const p = new Product(BASE);
    expect(() => p.addReview(0)).toThrow("1–5");
    expect(() => p.addReview(6)).toThrow("1–5");
  });

  // ─── toJSON ───────────────────────────────────────────────────────────────

  it("toJSON returns plain object", () => {
    const p = new Product(BASE);
    const json = p.toJSON();
    expect(json.name).toBe("Premium Yoga Mat");
    expect(Array.isArray(json.variants)).toBe(true);
  });
});
