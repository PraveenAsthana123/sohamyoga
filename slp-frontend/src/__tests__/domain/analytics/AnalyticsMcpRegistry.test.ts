import { describe, it, expect } from "@jest/globals";
import { AnalyticsMcpRegistry, ANALYTICS_MCP_TOOLS, type McpTier } from "../../../domain/analytics/AnalyticsMcpRegistry";

let registry: AnalyticsMcpRegistry;

beforeEach(() => {
  registry = new AnalyticsMcpRegistry();
});

// ── Tool catalogue ────────────────────────────────────────────────────────────

describe("AnalyticsMcpRegistry — catalogue", () => {
  it("contains exactly 12 tools", () => {
    expect(registry.toolCount()).toBe(12);
  });

  it("all tools have non-empty names", () => {
    registry.allTools().forEach(t => expect(t.name.length).toBeGreaterThan(0));
  });

  it("all tools have valid tiers", () => {
    const valid: McpTier[] = ["auto", "customer_confirm", "staff", "staff_approval", "admin", "admin_destructive"];
    registry.allTools().forEach(t => expect(valid).toContain(t.tier));
  });

  it("all tools have descriptions", () => {
    registry.allTools().forEach(t => expect(t.description.length).toBeGreaterThan(0));
  });

  const expectedTools = [
    "get_dashboard", "list_events",
    "get_session", "get_funnel", "get_cohort", "get_heatmap", "export_events", "get_user_journey",
    "opt_out_tracking",
    "get_session_replay", "get_user_pii",
    "delete_user_data",
  ];
  it.each(expectedTools)("tool '%s' is registered", name => {
    expect(registry.getTool(name)).toBeDefined();
  });
});

// ── Tier distribution ─────────────────────────────────────────────────────────

describe("toolsByTier()", () => {
  it("2 auto tools", () => {
    expect(registry.toolsByTier("auto")).toHaveLength(2);
  });

  it("6 staff tools", () => {
    expect(registry.toolsByTier("staff")).toHaveLength(6);
  });

  it("1 customer_confirm tool", () => {
    expect(registry.toolsByTier("customer_confirm")).toHaveLength(1);
  });

  it("2 staff_approval tools", () => {
    expect(registry.toolsByTier("staff_approval")).toHaveLength(2);
  });

  it("1 admin_destructive tool", () => {
    expect(registry.toolsByTier("admin_destructive")).toHaveLength(1);
  });

  it("0 admin tools", () => {
    expect(registry.toolsByTier("admin")).toHaveLength(0);
  });
});

// ── AUTO tier ────────────────────────────────────────────────────────────────

describe("AUTO tools", () => {
  it("get_dashboard succeeds with no args", () => {
    expect(registry.execute("get_dashboard", {})).toEqual({ ok: true });
  });

  it("list_events succeeds with no args", () => {
    expect(registry.execute("list_events", {})).toEqual({ ok: true });
  });
});

// ── STAFF tier ────────────────────────────────────────────────────────────────

describe("STAFF tools", () => {
  it("get_session requires sessionId", () => {
    expect(registry.execute("get_session", { sessionId: "sess-1" })).toEqual({ ok: true });
  });

  it("get_session fails without sessionId", () => {
    const r = registry.execute("get_session", {});
    expect(r.ok).toBe(false);
  });

  it("get_funnel requires funnelId", () => {
    expect(registry.execute("get_funnel", { funnelId: "fn-1" })).toEqual({ ok: true });
  });

  it("get_funnel fails without funnelId", () => {
    expect(registry.execute("get_funnel", {}).ok).toBe(false);
  });

  it("get_cohort requires cohortType, dateFrom, dateTo", () => {
    const r = registry.execute("get_cohort", {
      cohortType: "new", dateFrom: "2026-01-01", dateTo: "2026-08-05"
    });
    expect(r).toEqual({ ok: true });
  });

  it("get_cohort fails when any required field is missing", () => {
    expect(registry.execute("get_cohort", { cohortType: "new", dateFrom: "2026-01-01" }).ok).toBe(false);
  });

  it("get_heatmap requires url", () => {
    expect(registry.execute("get_heatmap", { url: "/classes" })).toEqual({ ok: true });
  });

  it("export_events requires dateFrom, dateTo, format", () => {
    const r = registry.execute("export_events", {
      dateFrom: "2026-01-01", dateTo: "2026-08-05", format: "csv"
    });
    expect(r).toEqual({ ok: true });
  });

  it("export_events fails without format", () => {
    expect(registry.execute("export_events", { dateFrom: "2026-01-01", dateTo: "2026-08-05" }).ok).toBe(false);
  });

  it("get_user_journey requires sessionId", () => {
    expect(registry.execute("get_user_journey", { sessionId: "sess-1" })).toEqual({ ok: true });
  });
});

// ── CUSTOMER_CONFIRM tier ─────────────────────────────────────────────────────

describe("CUSTOMER_CONFIRM tools", () => {
  it("opt_out_tracking succeeds with correct confirmText and anonymousId", () => {
    const r = registry.execute("opt_out_tracking", {
      anonymousId: "anon-abc", confirmText: "OPT_OUT"
    });
    expect(r).toEqual({ ok: true });
  });

  it("opt_out_tracking fails with wrong confirmText", () => {
    const r = registry.execute("opt_out_tracking", {
      anonymousId: "anon-abc", confirmText: "opt_out"
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("OPT_OUT");
  });

  it("opt_out_tracking fails without anonymousId", () => {
    expect(registry.execute("opt_out_tracking", { confirmText: "OPT_OUT" }).ok).toBe(false);
  });

  it("opt_out_tracking tool has confirmText=OPT_OUT", () => {
    expect(registry.getTool("opt_out_tracking")?.confirmText).toBe("OPT_OUT");
  });
});

// ── STAFF_APPROVAL tier ───────────────────────────────────────────────────────

describe("STAFF_APPROVAL tools", () => {
  it("get_session_replay succeeds with sessionId and confirmApprovalId", () => {
    const r = registry.execute("get_session_replay", {
      sessionId: "sess-1", confirmApprovalId: "appr-99"
    });
    expect(r).toEqual({ ok: true });
  });

  it("get_session_replay fails without confirmApprovalId", () => {
    const r = registry.execute("get_session_replay", { sessionId: "sess-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("confirmApprovalId");
  });

  it("get_session_replay fails with empty confirmApprovalId", () => {
    const r = registry.execute("get_session_replay", { sessionId: "sess-1", confirmApprovalId: "" });
    expect(r.ok).toBe(false);
  });

  it("get_user_pii requires userId and confirmApprovalId", () => {
    const r = registry.execute("get_user_pii", {
      userId: "user-1", confirmApprovalId: "appr-99"
    });
    expect(r).toEqual({ ok: true });
  });

  it("get_user_pii fails without userId", () => {
    expect(registry.execute("get_user_pii", { confirmApprovalId: "appr-99" }).ok).toBe(false);
  });

  it("get_session_replay has safetyNote about PII", () => {
    const tool = registry.getTool("get_session_replay");
    expect(tool?.safetyNote).toContain("PII");
  });

  it("get_user_pii has safetyNote about legal basis", () => {
    const tool = registry.getTool("get_user_pii");
    expect(tool?.safetyNote).toContain("legal basis");
  });
});

// ── ADMIN_DESTRUCTIVE tier ────────────────────────────────────────────────────

describe("ADMIN_DESTRUCTIVE tools", () => {
  it("delete_user_data succeeds with all required fields", () => {
    const r = registry.execute("delete_user_data", {
      userId: "user-1",
      confirmText: "DELETE_USER_DATA",
      confirmApprovalId: "appr-99",
    });
    expect(r).toEqual({ ok: true });
  });

  it("delete_user_data fails with wrong confirmText", () => {
    const r = registry.execute("delete_user_data", {
      userId: "user-1",
      confirmText: "delete_user_data",
      confirmApprovalId: "appr-99",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("DELETE_USER_DATA");
  });

  it("delete_user_data fails without confirmApprovalId", () => {
    const r = registry.execute("delete_user_data", {
      userId: "user-1",
      confirmText: "DELETE_USER_DATA",
    });
    expect(r.ok).toBe(false);
  });

  it("delete_user_data fails without userId", () => {
    const r = registry.execute("delete_user_data", {
      confirmText: "DELETE_USER_DATA",
      confirmApprovalId: "appr-99",
    });
    expect(r.ok).toBe(false);
  });

  it("delete_user_data has safetyNote mentioning GDPR", () => {
    expect(registry.getTool("delete_user_data")?.safetyNote).toContain("GDPR");
  });

  it("delete_user_data requires BOTH confirmText AND confirmApprovalId", () => {
    const tool = registry.getTool("delete_user_data");
    expect(tool?.confirmText).toBe("DELETE_USER_DATA");
    expect(tool?.confirmApprovalId).toBe(true);
  });
});

// ── Unknown tool ──────────────────────────────────────────────────────────────

describe("unknown tool", () => {
  it("execute returns error for unknown tool", () => {
    const r = registry.execute("no_such_tool", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Unknown tool");
  });

  it("getTool returns undefined for unknown tool", () => {
    expect(registry.getTool("no_such_tool")).toBeUndefined();
  });
});

// ── Null / undefined required fields ─────────────────────────────────────────

describe("null/undefined required fields", () => {
  it("null sessionId is rejected", () => {
    expect(registry.execute("get_session", { sessionId: null }).ok).toBe(false);
  });

  it("undefined sessionId is rejected", () => {
    expect(registry.execute("get_session", { sessionId: undefined }).ok).toBe(false);
  });

  it("empty string sessionId is rejected", () => {
    expect(registry.execute("get_session", { sessionId: "" }).ok).toBe(false);
  });
});

// ── Safety notes coverage ─────────────────────────────────────────────────────

describe("safety notes", () => {
  const sensitiveTools = ["export_events", "get_session_replay", "get_user_pii", "delete_user_data", "opt_out_tracking"];
  it.each(sensitiveTools)("tool '%s' has a safetyNote", name => {
    expect(registry.getTool(name)?.safetyNote).toBeDefined();
  });
});
