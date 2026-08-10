import { Marketplace, VendorProps, Settlement } from "@/domain/ecommerce/Marketplace";

const BASE: VendorProps = {
  id: "v1", name: "Ananya Yoga Studio", slug: "ananya-yoga-studio",
  type: "teacher", status: "active", email: "ananya@example.com",
  commissionType: "percentage", commissionRate: 20,
  settlementFrequency: "monthly",
  totalSales: 0, totalCommissionPaid: 0, pendingBalance: 0,
  settlements: [],
  metadata: {},
  createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
};

const PENDING_SETTLEMENT: Settlement = {
  id: "s1", period: "2026-07",
  grossAmount: 500, commissionAmount: 100, netAmount: 400,
  status: "pending",
};

describe("Marketplace (Vendor)", () => {
  // ─── Constructor validation ───────────────────────────────────────────────

  it("creates valid vendor", () => {
    const v = new Marketplace(BASE);
    expect(v.name).toBe("Ananya Yoga Studio");
    expect(v.commissionType).toBe("percentage");
    expect(v.commissionRate).toBe(20);
  });

  it("throws on empty name", () => {
    expect(() => new Marketplace({ ...BASE, name: "  " })).toThrow("name required");
  });

  it("throws on empty slug", () => {
    expect(() => new Marketplace({ ...BASE, slug: "" })).toThrow("Slug required");
  });

  it("throws on invalid slug", () => {
    expect(() => new Marketplace({ ...BASE, slug: "Ananya Studio" })).toThrow("kebab-case");
  });

  it("throws on empty email", () => {
    expect(() => new Marketplace({ ...BASE, email: "" })).toThrow("Email required");
  });

  it("throws on negative commissionRate", () => {
    expect(() => new Marketplace({ ...BASE, commissionRate: -1 })).toThrow("negative");
  });

  it("throws on percentage > 100", () => {
    expect(() => new Marketplace({ ...BASE, commissionType: "percentage", commissionRate: 101 })).toThrow("cannot exceed 100");
  });

  it("throws on tiered without tiers", () => {
    expect(() => new Marketplace({ ...BASE, commissionType: "tiered", commissionTiers: undefined })).toThrow("at least one tier");
  });

  it("throws on negative total sales", () => {
    expect(() => new Marketplace({ ...BASE, totalSales: -1 })).toThrow("negative");
  });

  it("throws on negative pendingBalance", () => {
    expect(() => new Marketplace({ ...BASE, pendingBalance: -1 })).toThrow("negative");
  });

  // ─── calculateCommission — percentage ─────────────────────────────────────

  it("calculates percentage commission", () => {
    const v = new Marketplace(BASE); // 20%
    expect(v.calculateCommission(100)).toBe(20);
    expect(v.calculateCommission(75.50)).toBe(15.1);
  });

  it("percentage commission on 0 returns 0", () => {
    expect(new Marketplace(BASE).calculateCommission(0)).toBe(0);
  });

  it("throws on negative order amount", () => {
    expect(() => new Marketplace(BASE).calculateCommission(-1)).toThrow("negative");
  });

  // ─── calculateCommission — fixed ──────────────────────────────────────────

  it("fixed commission capped at order amount", () => {
    const v = new Marketplace({ ...BASE, commissionType: "fixed", commissionRate: 10 });
    expect(v.calculateCommission(200)).toBe(10);
    expect(v.calculateCommission(5)).toBe(5); // can't exceed order amount
  });

  // ─── calculateCommission — tiered ─────────────────────────────────────────

  it("tiered commission selects correct tier", () => {
    const v = new Marketplace({
      ...BASE,
      commissionType: "tiered",
      commissionRate: 0,
      commissionTiers: [
        { minAmount: 0,    maxAmount: 100,  rate: 15 },
        { minAmount: 101,  maxAmount: 500,  rate: 12 },
        { minAmount: 501,                   rate: 10 },
      ],
    });
    expect(v.calculateCommission(80)).toBe(12);    // 15%
    expect(v.calculateCommission(200)).toBe(24);   // 12%
    expect(v.calculateCommission(1000)).toBe(100); // 10%
  });

  it("tiered returns 0 when no tier matches", () => {
    const v = new Marketplace({
      ...BASE, commissionType: "tiered", commissionRate: 0,
      commissionTiers: [{ minAmount: 100, maxAmount: 200, rate: 10 }],
    });
    expect(v.calculateCommission(50)).toBe(0);
  });

  // ─── vendorEarnings ───────────────────────────────────────────────────────

  it("vendorEarnings = orderAmount - commission", () => {
    const v = new Marketplace(BASE); // 20%
    expect(v.vendorEarnings(100)).toBe(80);
  });

  // ─── recordSale ───────────────────────────────────────────────────────────

  it("recordSale increments totalSales and pendingBalance by earnings", () => {
    const v = new Marketplace(BASE); // 20% commission
    const v2 = v.recordSale(500);
    expect(v2.totalSales).toBe(500);
    expect(v2.pendingBalance).toBe(400); // 500 - 100 commission
  });

  it("recordSale throws on inactive vendor", () => {
    const v = new Marketplace({ ...BASE, status: "suspended" });
    expect(() => v.recordSale(100)).toThrow("suspended");
  });

  it("recordSale throws on amount <= 0", () => {
    expect(() => new Marketplace(BASE).recordSale(0)).toThrow("> 0");
  });

  it("multiple recordSales accumulate correctly", () => {
    const v = new Marketplace(BASE);
    const v2 = v.recordSale(200).recordSale(300);
    expect(v2.totalSales).toBe(500);
    expect(v2.pendingBalance).toBe(400);
  });

  // ─── addSettlement ────────────────────────────────────────────────────────

  it("addSettlement appends settlement and reduces pendingBalance", () => {
    const v = new Marketplace({ ...BASE, pendingBalance: 400 });
    const v2 = v.addSettlement(PENDING_SETTLEMENT);
    expect(v2.settlements).toHaveLength(1);
    expect(v2.pendingBalance).toBe(0);
  });

  it("addSettlement throws when netAmount > pendingBalance", () => {
    const v = new Marketplace({ ...BASE, pendingBalance: 100 });
    expect(() => v.addSettlement(PENDING_SETTLEMENT)).toThrow("exceeds pending balance");
  });

  it("addSettlement throws on amount <= 0", () => {
    const v = new Marketplace({ ...BASE, pendingBalance: 500 });
    expect(() => v.addSettlement({ ...PENDING_SETTLEMENT, grossAmount: 0 })).toThrow("> 0");
  });

  // ─── markSettled ──────────────────────────────────────────────────────────

  it("markSettled updates settlement status and totalCommissionPaid", () => {
    const v = new Marketplace({ ...BASE, pendingBalance: 400, settlements: [PENDING_SETTLEMENT] });
    const v2 = v.markSettled("s1", "PAY-REF-001");
    expect(v2.settlements[0].status).toBe("settled");
    expect(v2.settlements[0].paymentReference).toBe("PAY-REF-001");
    expect(v2.totalCommissionPaid).toBe(100);
  });

  it("markSettled throws on unknown settlementId", () => {
    const v = new Marketplace(BASE);
    expect(() => v.markSettled("nope", "ref")).toThrow("not found");
  });

  it("markSettled throws on already settled", () => {
    const settled = { ...PENDING_SETTLEMENT, status: "settled" as const };
    const v = new Marketplace({ ...BASE, settlements: [settled] });
    expect(() => v.markSettled("s1", "ref")).toThrow("already settled");
  });

  it("markSettled throws on empty paymentReference", () => {
    const v = new Marketplace({ ...BASE, settlements: [PENDING_SETTLEMENT] });
    expect(() => v.markSettled("s1", "")).toThrow("required");
  });

  // ─── Status machine ───────────────────────────────────────────────────────

  it("activate from pending", () => {
    const v = new Marketplace({ ...BASE, status: "pending" });
    expect(v.activate().status).toBe("active");
  });

  it("activate throws on deactivated", () => {
    const v = new Marketplace({ ...BASE, status: "deactivated" });
    expect(() => v.activate()).toThrow("deactivated");
  });

  it("suspend active vendor with reason", () => {
    const v = new Marketplace(BASE);
    const v2 = v.suspend("Policy violation");
    expect(v2.status).toBe("suspended");
    expect(v2.suspendReason).toBe("Policy violation");
  });

  it("suspend throws without reason", () => {
    expect(() => new Marketplace(BASE).suspend("")).toThrow("reason required");
  });

  it("suspend throws on non-active vendor", () => {
    const v = new Marketplace({ ...BASE, status: "pending" });
    expect(() => v.suspend("reason")).toThrow("Can only suspend active");
  });

  it("deactivate from suspended", () => {
    const v = new Marketplace({ ...BASE, status: "suspended" });
    expect(v.deactivate().status).toBe("deactivated");
  });

  it("deactivate throws if already deactivated", () => {
    const v = new Marketplace({ ...BASE, status: "deactivated" });
    expect(() => v.deactivate()).toThrow("Already deactivated");
  });

  // ─── toJSON / defensive copies ────────────────────────────────────────────

  it("settlements getter returns defensive copy", () => {
    const v = new Marketplace({ ...BASE, settlements: [PENDING_SETTLEMENT] });
    const s = v.settlements;
    s.push({ ...PENDING_SETTLEMENT, id: "hack" });
    expect(v.settlements).toHaveLength(1);
  });

  it("toJSON returns serialisable object", () => {
    const json = new Marketplace(BASE).toJSON();
    expect(json.name).toBe("Ananya Yoga Studio");
    expect(Array.isArray(json.settlements)).toBe(true);
  });
});
