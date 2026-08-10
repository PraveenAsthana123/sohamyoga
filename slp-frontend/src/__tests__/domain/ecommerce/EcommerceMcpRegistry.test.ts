import { EcommerceMcpRegistry, ECOMMERCE_MCP_TOOLS } from "@/domain/ecommerce/EcommerceMcpRegistry";

describe("EcommerceMcpRegistry", () => {
  const registry = new EcommerceMcpRegistry();

  // ─── Catalog ──────────────────────────────────────────────────────────────

  it("has exactly 12 tools", () => {
    expect(ECOMMERCE_MCP_TOOLS).toHaveLength(12);
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

  // ─── get ──────────────────────────────────────────────────────────────────

  it("get() finds known tool", () => {
    const t = registry.get("search_product");
    expect(t).toBeDefined();
    expect(t!.name).toBe("Search Products");
  });

  it("get() returns undefined for unknown key", () => {
    expect(registry.get("hack_store")).toBeUndefined();
  });

  // ─── listByAccess ─────────────────────────────────────────────────────────

  it("auto-access tools include read-only lookups", () => {
    const auto = registry.listByAccess("auto");
    expect(auto.length).toBeGreaterThanOrEqual(5);
    auto.forEach(t => expect(t.access).toBe("auto"));
  });

  it("search_product is auto", () => {
    expect(registry.get("search_product")?.access).toBe("auto");
  });

  it("recommend_product is auto", () => {
    expect(registry.get("recommend_product")?.access).toBe("auto");
  });

  it("inventory_status is auto", () => {
    expect(registry.get("inventory_status")?.access).toBe("auto");
  });

  it("wallet_balance is auto", () => {
    expect(registry.get("wallet_balance")?.access).toBe("auto");
  });

  it("track_order is auto", () => {
    expect(registry.get("track_order")?.access).toBe("auto");
  });

  it("create_order is staff", () => {
    expect(registry.get("create_order")?.access).toBe("staff");
  });

  it("generate_invoice is staff", () => {
    expect(registry.get("generate_invoice")?.access).toBe("staff");
  });

  it("refund_order is staff_approval", () => {
    expect(registry.get("refund_order")?.access).toBe("staff_approval");
  });

  it("cancel_order is admin_destructive", () => {
    expect(registry.get("cancel_order")?.access).toBe("admin_destructive");
  });

  it("return_request is customer_confirm", () => {
    expect(registry.get("return_request")?.access).toBe("customer_confirm");
  });

  // ─── listDestructive ──────────────────────────────────────────────────────

  it("listDestructive returns only cancel_order", () => {
    const d = registry.listDestructive();
    expect(d).toHaveLength(1);
    expect(d[0].key).toBe("cancel_order");
  });

  // ─── listRequiringApproval ────────────────────────────────────────────────

  it("listRequiringApproval contains refund_order and cancel_order", () => {
    const ap = registry.listRequiringApproval();
    const keys = ap.map(t => t.key);
    expect(keys).toContain("refund_order");
    expect(keys).toContain("cancel_order");
  });

  // ─── canExecute — destructive ─────────────────────────────────────────────

  it("cancel_order — denied without confirmText", () => {
    const result = registry.canExecute("cancel_order", {
      orderId: "o1", cancelledBy: "admin1", reason: "test",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/confirmText/);
  });

  it("cancel_order — denied with wrong confirmText", () => {
    const result = registry.canExecute("cancel_order", {
      orderId: "o1", cancelledBy: "admin1", reason: "test",
      confirmText: "DELETE",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/CANCEL_ORDER/);
  });

  it("cancel_order — denied without confirmApprovalId", () => {
    const result = registry.canExecute("cancel_order", {
      orderId: "o1", cancelledBy: "admin1", reason: "test",
      confirmText: "CANCEL_ORDER",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/confirmApprovalId/);
  });

  it("cancel_order — allowed with correct confirmText and approvalId", () => {
    const result = registry.canExecute("cancel_order", {
      orderId: "o1", cancelledBy: "admin1", reason: "test",
      confirmText: "CANCEL_ORDER", confirmApprovalId: "mgr_001",
    });
    expect(result.allowed).toBe(true);
  });

  // ─── canExecute — customer_confirm ───────────────────────────────────────

  it("return_request — denied without confirmText", () => {
    const result = registry.canExecute("return_request", {
      orderId: "o1", reason: "defective",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/REQUEST_RETURN/);
  });

  it("return_request — denied with wrong confirmText", () => {
    const result = registry.canExecute("return_request", {
      orderId: "o1", reason: "defective", confirmText: "YES",
    });
    expect(result.allowed).toBe(false);
  });

  it("return_request — allowed with correct confirmText", () => {
    const result = registry.canExecute("return_request", {
      orderId: "o1", reason: "defective", confirmText: "REQUEST_RETURN",
    });
    expect(result.allowed).toBe(true);
  });

  // ─── canExecute — staff_approval ──────────────────────────────────────────

  it("refund_order — denied without confirmApprovalId", () => {
    const result = registry.canExecute("refund_order", {
      orderId: "o1", amount: 50, reason: "customer request",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/confirmApprovalId/);
  });

  it("refund_order — allowed with confirmApprovalId", () => {
    const result = registry.canExecute("refund_order", {
      orderId: "o1", amount: 50, reason: "customer request",
      confirmApprovalId: "mgr_001",
    });
    expect(result.allowed).toBe(true);
  });

  // ─── canExecute — missing required fields ─────────────────────────────────

  it("search_product — denied when query missing", () => {
    const result = registry.canExecute("search_product", {});
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/query/);
  });

  it("search_product — allowed with query", () => {
    const result = registry.canExecute("search_product", { query: "yoga mat" });
    expect(result.allowed).toBe(true);
  });

  it("recommend_product — denied without customerId", () => {
    const result = registry.canExecute("recommend_product", {});
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/customerId/);
  });

  it("create_order — denied when paymentMethod missing", () => {
    const result = registry.canExecute("create_order", {
      cartId: "cart_1", customerId: "cust_1",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/paymentMethod/);
  });

  it("create_order — allowed with all required fields", () => {
    const result = registry.canExecute("create_order", {
      cartId: "cart_1", customerId: "cust_1", paymentMethod: "stripe",
    });
    expect(result.allowed).toBe(true);
  });

  // ─── canExecute — unknown tool ────────────────────────────────────────────

  it("unknown tool → denied", () => {
    const result = registry.canExecute("hack_store", {});
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Unknown tool/);
  });

  // ─── Safety notes ─────────────────────────────────────────────────────────

  it("cancel_order has safetyNote", () => {
    expect(registry.get("cancel_order")?.safetyNote).toBeDefined();
  });

  it("recommend_product safety note says cannot auto-purchase", () => {
    expect(registry.get("recommend_product")?.safetyNote).toMatch(/auto-purchase/);
  });

  it("return_request has safetyNote about policy", () => {
    expect(registry.get("return_request")?.safetyNote).toMatch(/policy/);
  });
});
