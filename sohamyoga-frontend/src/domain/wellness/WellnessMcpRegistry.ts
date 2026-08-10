// Wave 17: Health & Wellness — MCP Tool Registry
// 13 tools: 2 auto / 5 staff / 1 customer_confirm / 2 staff_approval / 2 admin / 1 admin_destructive

export type McpTier =
  | 'auto' | 'staff' | 'customer_confirm' | 'staff_approval' | 'admin' | 'admin_destructive';

export interface McpTool {
  name:               string;
  tier:               McpTier;
  description:        string;
  confirmText?:       string;
  confirmApprovalId?: true;
  safetyNote?:        string;
}

export interface McpResult {
  tool:   McpTool;
  params: Record<string, unknown>;
}

export class WellnessMcpRegistry {
  private readonly tools: McpTool[] = [
    // ── AUTO (2) ─────────────────────────────────────────────────────────────
    { name: 'get_wellness_summary',     tier: 'auto',  description: 'Get aggregated wellness summary across all customers (anonymised)' },
    { name: 'get_body_metrics_history', tier: 'auto',  description: 'Get body metrics history as anonymised aggregate trend' },

    // ── STAFF (5) ────────────────────────────────────────────────────────────
    { name: 'log_body_metrics',         tier: 'staff', description: 'Log weight, height, and body measurements for a customer' },
    { name: 'log_daily_wellness',       tier: 'staff', description: 'Log daily wellness: sleep, water, steps, mood, energy, stress' },
    { name: 'update_fitness_level',     tier: 'staff', description: 'Update fitness level classification for a customer' },
    { name: 'connect_wearable',         tier: 'staff', description: 'Connect a wearable device platform (Fitbit, Garmin, Apple Health, Google Fit) for a customer' },
    { name: 'get_wellness_report',      tier: 'staff', description: 'Get detailed wellness report for a specific customer' },

    // ── CUSTOMER_CONFIRM (1) ─────────────────────────────────────────────────
    { name: 'reset_wellness_log',       tier: 'customer_confirm', description: 'Reset all wellness log entries for the authenticated customer', confirmText: 'RESET_WELLNESS' },

    // ── STAFF_APPROVAL (2) ───────────────────────────────────────────────────
    { name: 'get_health_profile',       tier: 'staff_approval', description: 'Access full health profile including conditions, medications, injuries, and pregnancy status', confirmApprovalId: true, safetyNote: 'Health profile contains sensitive PII — HIPAA/PIPEDA compliant access; log legal basis in audit trail' },
    { name: 'export_health_data',       tier: 'staff_approval', description: 'Export all health and wellness data for a customer as structured JSON', confirmApprovalId: true, safetyNote: 'Exported data contains sensitive health PII — de-identify before external use; GDPR Art. 9 applies' },

    // ── ADMIN (2) ────────────────────────────────────────────────────────────
    { name: 'bulk_wellness_report',     tier: 'admin', description: 'Generate wellness analytics report across the full customer base' },
    { name: 'get_wellness_analytics',   tier: 'admin', description: 'Get aggregated wellness metrics, BMI distribution, and trend analytics' },

    // ── ADMIN_DESTRUCTIVE (1) ────────────────────────────────────────────────
    { name: 'delete_health_profile',    tier: 'admin_destructive', description: 'Permanently delete health profile and all wellness data for a customer', confirmText: 'DELETE_HEALTH_PROFILE', confirmApprovalId: true, safetyNote: 'Irreversible deletion of all health data — GDPR right-to-erasure only; cannot be undone' },
  ];

  getAll(): McpTool[] {
    return [...this.tools];
  }

  get(name: string): McpTool {
    const tool = this.tools.find(t => t.name === name);
    if (!tool) throw new Error(`tool "${name}" not found`);
    return tool;
  }

  byTier(tier: McpTier): McpTool[] {
    return this.tools.filter(t => t.tier === tier);
  }

  execute(name: string, params: Record<string, unknown>): McpResult {
    if (!name?.trim()) throw new Error('tool name is required');
    const tool = this.get(name);

    if (tool.tier === 'customer_confirm') {
      if (!params.confirmText)
        throw new Error('confirmText is required');
      if (params.confirmText !== tool.confirmText)
        throw new Error(`confirmText must be "${tool.confirmText}"`);
    }

    if (tool.tier === 'staff_approval') {
      if (!params.confirmApprovalId)
        throw new Error('confirmApprovalId is required');
    }

    if (tool.tier === 'admin_destructive') {
      if (!params.confirmText)
        throw new Error('confirmText is required');
      if (params.confirmText !== tool.confirmText)
        throw new Error(`confirmText must be "${tool.confirmText}"`);
      if (!params.confirmApprovalId)
        throw new Error('confirmApprovalId is required');
    }

    return { tool, params };
  }
}
