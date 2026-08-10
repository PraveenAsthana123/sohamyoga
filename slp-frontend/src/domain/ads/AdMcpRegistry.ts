// Wave 15: Google Ads-like Platform — MCP Tool Registry

export type McpTier =
  | 'auto'
  | 'staff'
  | 'customer_confirm'
  | 'staff_approval'
  | 'admin'
  | 'admin_destructive';

export interface AdMcpTool {
  name:               string;
  tier:               McpTier;
  description:        string;
  confirmText?:       string;
  confirmApprovalId?: boolean;
  safetyNote?:        string;
}

export interface ExecuteResult {
  tool:   AdMcpTool;
  params: Record<string, unknown>;
}

export class AdMcpRegistry {
  private readonly tools: AdMcpTool[] = [
    // ── AUTO (2) ───────────────────────────────────────────────────────────────
    {
      name:        'get_campaigns',
      tier:        'auto',
      description: 'List all ad campaigns with status and budget summary',
    },
    {
      name:        'get_campaign_summary',
      tier:        'auto',
      description: 'Get aggregate CTR, CPC, spend, and impressions across all active campaigns',
    },

    // ── STAFF (5) ─────────────────────────────────────────────────────────────
    {
      name:        'get_campaign',
      tier:        'staff',
      description: 'Get full campaign details including ad groups, keywords, and targeting',
    },
    {
      name:        'create_campaign',
      tier:        'staff',
      description: 'Create a new campaign with type, budget, targeting, and bidding strategy',
    },
    {
      name:        'update_campaign',
      tier:        'staff',
      description: 'Update campaign name, budget, status, geo targets, or device targets',
    },
    {
      name:        'pause_campaign',
      tier:        'staff',
      description: 'Pause an active campaign immediately; all ads stop serving',
    },
    {
      name:        'get_ad_performance',
      tier:        'staff',
      description: 'Get per-ad clicks, impressions, CTR, CPC, conversions for a campaign',
    },

    // ── CUSTOMER_CONFIRM (1) ──────────────────────────────────────────────────
    {
      name:        'opt_out_ad_targeting',
      tier:        'customer_confirm',
      description: 'Opt customer out of personalized ad targeting (GDPR / PIPEDA right to object)',
      confirmText: 'OPT_OUT_ADS',
    },

    // ── STAFF_APPROVAL (2) ────────────────────────────────────────────────────
    {
      name:             'get_audience_data',
      tier:             'staff_approval',
      description:      'Access audience targeting data including segments and lookalike audiences — PII-adjacent, audit-logged',
      confirmApprovalId: true,
      safetyNote:        'Audience data may link to personal attributes. All access is logged in ad_audit.',
    },
    {
      name:             'export_campaign_report',
      tier:             'staff_approval',
      description:      'Export full campaign performance report as CSV including conversion attribution data',
      confirmApprovalId: true,
    },

    // ── ADMIN (2) ─────────────────────────────────────────────────────────────
    {
      name:        'set_campaign_budget',
      tier:        'admin',
      description: 'Override campaign daily or total budget; may affect live serving immediately',
    },
    {
      name:        'get_billing_analytics',
      tier:        'admin',
      description: 'Get total ad spend, billing history, ROAS, and budget utilisation across all campaigns',
    },

    // ── ADMIN_DESTRUCTIVE (1) ─────────────────────────────────────────────────
    {
      name:             'delete_campaign_data',
      tier:             'admin_destructive',
      description:      'Permanently delete all campaign data including ads, analytics, and audience segments — irreversible',
      confirmText:       'DELETE_CAMPAIGN',
      confirmApprovalId: true,
      safetyNote:        'Permanent: removes campaign, ad groups, ads, analytics, and audience data. Cannot be undone. Ensure GDPR/PIPEDA compliance before deletion.',
    },
  ];

  getAll(): AdMcpTool[] {
    return [...this.tools];
  }

  get(name: string): AdMcpTool {
    const tool = this.tools.find(t => t.name === name);
    if (!tool) throw new Error(`AdMcpTool "${name}" not found`);
    return tool;
  }

  byTier(tier: McpTier): AdMcpTool[] {
    return this.tools.filter(t => t.tier === tier);
  }

  execute(name: string, params: Record<string, unknown>): ExecuteResult {
    if (!name?.trim()) throw new Error('tool name is required');
    const tool = this.get(name); // throws if not found

    if (tool.confirmText !== undefined) {
      if (!params.confirmText) throw new Error(`confirmText is required for "${name}"`);
      if (params.confirmText !== tool.confirmText)
        throw new Error(`confirmText must be "${tool.confirmText}"`);
    }

    if (tool.confirmApprovalId === true) {
      if (!params.confirmApprovalId) throw new Error(`confirmApprovalId is required for "${name}"`);
    }

    return { tool, params };
  }
}
