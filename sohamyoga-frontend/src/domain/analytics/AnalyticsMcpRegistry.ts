export type McpTier =
  | "auto"
  | "customer_confirm"
  | "staff"
  | "staff_approval"
  | "admin"
  | "admin_destructive";

export interface McpToolSpec {
  name: string;
  tier: McpTier;
  description: string;
  requiredFields: string[];
  confirmText?: string;
  confirmApprovalId?: boolean;
  safetyNote?: string;
}

export class AnalyticsMcpRegistry {
  private readonly tools: Map<string, McpToolSpec>;

  constructor() {
    this.tools = new Map(ANALYTICS_MCP_TOOLS.map(t => [t.name, t]));
  }

  getTool(name: string): McpToolSpec | undefined {
    return this.tools.get(name);
  }

  allTools(): McpToolSpec[] {
    return Array.from(this.tools.values());
  }

  toolsByTier(tier: McpTier): McpToolSpec[] {
    return this.allTools().filter(t => t.tier === tier);
  }

  toolCount(): number {
    return this.tools.size;
  }

  execute(
    toolName: string,
    args: Record<string, unknown>
  ): { ok: true } | { ok: false; error: string } {
    const tool = this.tools.get(toolName);
    if (!tool) return { ok: false, error: `Unknown tool: ${toolName}` };

    // Required fields check
    for (const field of tool.requiredFields) {
      const val = args[field];
      if (val === null || val === undefined || val === "")
        return { ok: false, error: `${field} is required for ${toolName}` };
    }

    // Confirm text check
    if (tool.confirmText && args["confirmText"] !== tool.confirmText)
      return { ok: false, error: `confirmText must be "${tool.confirmText}"` };

    // Approval ID check
    if (tool.confirmApprovalId) {
      const id = args["confirmApprovalId"];
      if (!id || id === "")
        return { ok: false, error: "confirmApprovalId is required" };
    }

    return { ok: true };
  }
}

export const ANALYTICS_MCP_TOOLS: McpToolSpec[] = [
  // ── AUTO ──────────────────────────────────────────────────────────────────
  {
    name: "get_dashboard",
    tier: "auto",
    description: "Retrieve aggregated analytics KPIs: visitors, page views, sessions, bounce rate, top pages",
    requiredFields: [],
  },
  {
    name: "list_events",
    tier: "auto",
    description: "List recent tracking events with type, url, and timestamp",
    requiredFields: [],
  },

  // ── STAFF ─────────────────────────────────────────────────────────────────
  {
    name: "get_session",
    tier: "staff",
    description: "Retrieve anonymised session details: pages, events, duration, device, traffic source",
    requiredFields: ["sessionId"],
  },
  {
    name: "get_funnel",
    tier: "staff",
    description: "Get step-by-step conversion rates and drop-off for a defined funnel",
    requiredFields: ["funnelId"],
  },
  {
    name: "get_cohort",
    tier: "staff",
    description: "Analyse a user cohort (new, returning, converted) over a date range",
    requiredFields: ["cohortType", "dateFrom", "dateTo"],
  },
  {
    name: "get_heatmap",
    tier: "staff",
    description: "Return click and scroll heatmap data for a given URL",
    requiredFields: ["url"],
  },
  {
    name: "export_events",
    tier: "staff",
    description: "Export anonymised events as CSV or JSON for a date range",
    requiredFields: ["dateFrom", "dateTo", "format"],
    safetyNote: "Exported data must be de-identified; do not export raw userId without legal basis",
  },
  {
    name: "get_user_journey",
    tier: "staff",
    description: "Return ordered page + event sequence for an anonymous session",
    requiredFields: ["sessionId"],
  },

  // ── CUSTOMER_CONFIRM ──────────────────────────────────────────────────────
  {
    name: "opt_out_tracking",
    tier: "customer_confirm",
    description: "Opt out this visitor from all non-essential tracking; sets consent level to essential",
    requiredFields: ["anonymousId"],
    confirmText: "OPT_OUT",
    safetyNote: "Immediately stops PostHog, OpenReplay and Umami collection for this visitor",
  },

  // ── STAFF_APPROVAL ────────────────────────────────────────────────────────
  {
    name: "get_session_replay",
    tier: "staff_approval",
    description: "Stream OpenReplay session recording for a session ID",
    requiredFields: ["sessionId", "confirmApprovalId"],
    confirmApprovalId: true,
    safetyNote: "Session replay may expose PII visible on screen; legal basis required under GDPR/PIPEDA",
  },
  {
    name: "get_user_pii",
    tier: "staff_approval",
    description: "Retrieve identified user tracking data linked to a userId for GDPR subject access request",
    requiredFields: ["userId", "confirmApprovalId"],
    confirmApprovalId: true,
    safetyNote: "Raw PII access; only permitted for subject access requests with documented legal basis",
  },

  // ── ADMIN_DESTRUCTIVE ─────────────────────────────────────────────────────
  {
    name: "delete_user_data",
    tier: "admin_destructive",
    description: "GDPR/PIPEDA right-to-erasure: permanently delete all events, sessions and consent records for a userId",
    requiredFields: ["userId", "confirmText", "confirmApprovalId"],
    confirmText: "DELETE_USER_DATA",
    confirmApprovalId: true,
    safetyNote: "Irreversible. Cascades to tracking_event, tracking_session, consent_record, heatmap_event. Audit log entry is retained per GDPR Art. 5(2).",
  },
];
