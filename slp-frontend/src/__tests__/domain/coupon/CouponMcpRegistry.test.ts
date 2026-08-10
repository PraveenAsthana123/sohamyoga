import { CouponMcpRegistry, COUPON_MCP_TOOLS } from "@/domain/coupon/CouponMcpRegistry";

describe("CouponMcpRegistry", () => {
  const registry = new CouponMcpRegistry();

  // --- Catalog completeness ---
  it("has exactly 13 tools", () => {
    expect(COUPON_MCP_TOOLS).toHaveLength(13);
  });

  it("list() returns all 13 tools", () => {
    expect(registry.list()).toHaveLength(13);
  });

  it("all tools have non-empty keys and names", () => {
    registry.list().forEach(t => {
      expect(t.key.trim()).not.toBe("");
      expect(t.name.trim()).not.toBe("");
    });
  });

  it("all tool keys are unique", () => {
    const keys = registry.list().map(t => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // --- get ---
  it("get() finds a known tool by key", () => {
    const t = registry.get("validate_coupon");
    expect(t).toBeDefined();
    expect(t!.name).toBe("Validate Coupon");
  });

  it("get() returns undefined for unknown key", () => {
    expect(registry.get("nonexistent_tool")).toBeUndefined();
  });

  // --- Destructive ---
  it("listDestructive() returns only revoke_coupon", () => {
    const d = registry.listDestructive();
    expect(d).toHaveLength(1);
    expect(d[0].key).toBe("revoke_coupon");
  });

  // --- Approval-gated ---
  it("listRequiringApproval() returns 3 tools", () => {
    const ap = registry.listRequiringApproval();
    expect(ap).toHaveLength(3);
    const keys = ap.map(t => t.key);
    expect(keys).toContain("generate_unique_codes");
    expect(keys).toContain("activate_campaign");
    expect(keys).toContain("revoke_coupon");
  });

  // --- Access filtering ---
  it("listByAccess('auto') returns read-only auto tools", () => {
    const auto = registry.listByAccess("auto");
    expect(auto.length).toBeGreaterThanOrEqual(3);
    auto.forEach(t => expect(t.access).toBe("auto"));
  });

  it("listByAccess('audit_restricted') returns investigate_redemption only", () => {
    const ar = registry.listByAccess("audit_restricted");
    expect(ar).toHaveLength(1);
    expect(ar[0].key).toBe("investigate_redemption");
  });

  // --- canExecute: destructive guard ---
  it("revoke_coupon — denied without confirmText", () => {
    const result = registry.canExecute("revoke_coupon", {
      couponId: "c1", revokedBy: "admin1", reason: "fraud",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/confirmText/);
  });

  it("revoke_coupon — denied with wrong confirmText", () => {
    const result = registry.canExecute("revoke_coupon", {
      couponId: "c1", revokedBy: "admin1", reason: "fraud", confirmText: "yes",
    });
    expect(result.allowed).toBe(false);
  });

  it("revoke_coupon — allowed with confirmText='REVOKE'", () => {
    const result = registry.canExecute("revoke_coupon", {
      couponId: "c1", revokedBy: "admin1", reason: "fraud", confirmText: "REVOKE",
    });
    expect(result.allowed).toBe(true);
  });

  // --- canExecute: approval guard ---
  it("generate_unique_codes — denied without confirmApprovalId", () => {
    const result = registry.canExecute("generate_unique_codes", {
      campaignId: "camp1", quantity: 100,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/confirmApprovalId/);
  });

  it("generate_unique_codes — allowed with confirmApprovalId", () => {
    const result = registry.canExecute("generate_unique_codes", {
      campaignId: "camp1", quantity: 100, confirmApprovalId: "apr_xyz",
    });
    expect(result.allowed).toBe(true);
  });

  it("activate_campaign — denied without confirmApprovalId", () => {
    const result = registry.canExecute("activate_campaign", { campaignId: "camp1" });
    expect(result.allowed).toBe(false);
  });

  // --- canExecute: audit role guard ---
  it("investigate_redemption — denied without auditRoleToken", () => {
    const result = registry.canExecute("investigate_redemption", { redemptionId: "r1" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/auditRoleToken/);
  });

  it("investigate_redemption — allowed with auditRoleToken", () => {
    const result = registry.canExecute("investigate_redemption", {
      redemptionId: "r1", auditRoleToken: "aud_secure_token",
    });
    expect(result.allowed).toBe(true);
  });

  // --- canExecute: missing required fields ---
  it("validate_coupon — denied when required fields missing", () => {
    const result = registry.canExecute("validate_coupon", { couponCode: "SUMMER20" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Missing required fields/);
  });

  it("validate_coupon — allowed with all required fields", () => {
    const result = registry.canExecute("validate_coupon", {
      couponCode: "SUMMER20", customerId: "cust_1", orderAmount: 100,
    });
    expect(result.allowed).toBe(true);
  });

  // --- canExecute: unknown tool ---
  it("unknown tool — returns denied", () => {
    const result = registry.canExecute("hack_the_planet", {});
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Unknown tool/);
  });

  // --- Read-only tools need no special tokens ---
  it("preview_discount — allowed without any tokens (read-only)", () => {
    const result = registry.canExecute("preview_discount", {
      couponCode: "SAVE10", orderAmount: 150,
    });
    expect(result.allowed).toBe(true);
  });

  it("get_coupon_analytics — allowed with required date fields", () => {
    const result = registry.canExecute("get_coupon_analytics", {
      dateFrom: "2026-01-01", dateTo: "2026-12-31",
    });
    expect(result.allowed).toBe(true);
  });

  // --- Safety notes on key tools ---
  it("revoke_coupon has a safetyNote", () => {
    expect(registry.get("revoke_coupon")?.safetyNote).toBeDefined();
  });

  it("create_coupon_draft has a safetyNote about CAD 500 threshold", () => {
    const t = registry.get("create_coupon_draft");
    expect(t?.safetyNote).toMatch(/CAD 500/);
  });
});
