import { PricingMcpRegistry, PRICING_MCP_TOOLS } from "@/domain/pricing/PricingMcpRegistry";

describe("PricingMcpRegistry", () => {
  const registry = new PricingMcpRegistry();

  // --- Catalog ---
  it("has exactly 12 tools", () => {
    expect(PRICING_MCP_TOOLS).toHaveLength(12);
  });

  it("list() returns all 12 tools", () => {
    expect(registry.list()).toHaveLength(12);
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
  it("get() finds known tool", () => {
    const t = registry.get("recommend_plan");
    expect(t).toBeDefined();
    expect(t!.name).toBe("Recommend Best Plan");
  });

  it("get() returns undefined for unknown key", () => {
    expect(registry.get("hack_pricing")).toBeUndefined();
  });

  // --- Destructive ---
  it("listDestructive() returns only cancel_subscription", () => {
    const d = registry.listDestructive();
    expect(d).toHaveLength(1);
    expect(d[0].key).toBe("cancel_subscription");
  });

  // --- Approval gated ---
  it("listRequiringApproval() returns 2 tools", () => {
    const ap = registry.listRequiringApproval();
    expect(ap).toHaveLength(2);
    const keys = ap.map(t => t.key);
    expect(keys).toContain("create_membership");
    expect(keys).toContain("cancel_subscription");
  });

  // --- Access filtering ---
  it("listByAccess('auto') returns read-only tools", () => {
    const auto = registry.listByAccess("auto");
    expect(auto.length).toBeGreaterThanOrEqual(4);
    auto.forEach(t => expect(t.access).toBe("auto"));
  });

  it("compare_plan is auto access", () => {
    expect(registry.get("compare_plan")?.access).toBe("auto");
  });

  it("recommend_bundle is auto access", () => {
    expect(registry.get("recommend_bundle")?.access).toBe("auto");
  });

  it("wallet_balance is auto access", () => {
    expect(registry.get("wallet_balance")?.access).toBe("auto");
  });

  // --- canExecute: destructive ---
  it("cancel_subscription — denied without confirmText", () => {
    const result = registry.canExecute("cancel_subscription", {
      subscriptionId: "s1", cancelledBy: "admin1", reason: "test",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/confirmText/);
  });

  it("cancel_subscription — denied with wrong confirmText", () => {
    const result = registry.canExecute("cancel_subscription", {
      subscriptionId: "s1", cancelledBy: "admin1", reason: "test", confirmText: "YES",
    });
    expect(result.allowed).toBe(false);
  });

  it("cancel_subscription — allowed with confirmText='CANCEL'", () => {
    const result = registry.canExecute("cancel_subscription", {
      subscriptionId: "s1", cancelledBy: "admin1", reason: "test", confirmText: "CANCEL",
    });
    expect(result.allowed).toBe(true);
  });

  // --- canExecute: approval gated ---
  it("create_membership — denied without confirmApprovalId", () => {
    const result = registry.canExecute("create_membership", {
      name: "Platinum", slug: "platinum-monthly", type: "platinum",
      prices: [], benefits: {},
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/confirmApprovalId/);
  });

  it("create_membership — allowed with confirmApprovalId", () => {
    const result = registry.canExecute("create_membership", {
      name: "Platinum", slug: "platinum-monthly", type: "platinum",
      prices: [], benefits: {}, confirmApprovalId: "mgr_token_123",
    });
    expect(result.allowed).toBe(true);
  });

  // --- canExecute: missing fields ---
  it("recommend_plan — denied when required fields missing", () => {
    const result = registry.canExecute("recommend_plan", {});
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Missing required fields/);
  });

  it("recommend_plan — allowed with customerId", () => {
    const result = registry.canExecute("recommend_plan", { customerId: "cust_1" });
    expect(result.allowed).toBe(true);
  });

  // --- canExecute: customer_confirm tools ---
  it("upgrade_plan — allowed with required fields", () => {
    const result = registry.canExecute("upgrade_plan", {
      subscriptionId: "s1", newPlanId: "plan_platinum", customerId: "cust_1",
    });
    expect(result.allowed).toBe(true);
  });

  it("downgrade_plan — allowed with required fields", () => {
    const result = registry.canExecute("downgrade_plan", {
      subscriptionId: "s1", newPlanId: "plan_silver", customerId: "cust_1",
    });
    expect(result.allowed).toBe(true);
  });

  // --- unknown tool ---
  it("unknown tool → denied", () => {
    const result = registry.canExecute("unknown_tool", {});
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Unknown tool/);
  });

  // --- Safety notes ---
  it("cancel_subscription has safetyNote", () => {
    expect(registry.get("cancel_subscription")?.safetyNote).toBeDefined();
  });

  it("recommend_plan has safetyNote about no auto-subscribe", () => {
    expect(registry.get("recommend_plan")?.safetyNote).toMatch(/auto-subscribe/);
  });
});
