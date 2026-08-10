// Wave 16: Customer Journey Management — MCP Tool Registry

export type McpTier =
  | 'auto'
  | 'staff'
  | 'customer_confirm'
  | 'staff_approval'
  | 'admin'
  | 'admin_destructive';

export interface JourneyMcpTool {
  name:               string;
  tier:               McpTier;
  description:        string;
  confirmText?:       string;
  confirmApprovalId?: boolean;
  safetyNote?:        string;
}

export interface ExecuteResult {
  tool:   JourneyMcpTool;
  params: Record<string, unknown>;
}

export class JourneyMcpRegistry {
  private readonly tools: JourneyMcpTool[] = [
    // ── AUTO (2) ───────────────────────────────────────────────────────────────
    {
      name:        'get_journey_summary',
      tier:        'auto',
      description: 'Get summary of customer journeys: phase distribution, avg streak, completion rate',
    },
    {
      name:        'get_milestone_stats',
      tier:        'auto',
      description: 'Aggregate milestone achievement counts and most common reward types',
    },

    // ── STAFF (5) ─────────────────────────────────────────────────────────────
    {
      name:        'get_customer_journey',
      tier:        'staff',
      description: 'Get full journey detail: phase, goals, streak, session history, milestones',
    },
    {
      name:        'advance_journey_phase',
      tier:        'staff',
      description: 'Manually advance a customer to the next journey phase',
    },
    {
      name:        'award_milestone',
      tier:        'staff',
      description: 'Award a milestone reward to a customer (for manual achievements)',
    },
    {
      name:        'update_weekly_target',
      tier:        'staff',
      description: 'Update the customer\'s weekly practice target in minutes',
    },
    {
      name:        'get_habit_report',
      tier:        'staff',
      description: 'Get 30-day habit completion report for a customer',
    },

    // ── CUSTOMER_CONFIRM (1) ──────────────────────────────────────────────────
    {
      name:        'reset_journey',
      tier:        'customer_confirm',
      description: 'Reset journey to onboarding phase — customer loses streak and phase progress',
      confirmText: 'RESET_JOURNEY',
    },

    // ── STAFF_APPROVAL (2) ────────────────────────────────────────────────────
    {
      name:             'get_health_profile',
      tier:             'staff_approval',
      description:      'Access customer health profile including conditions, injuries, and medications — sensitive PII',
      confirmApprovalId: true,
      safetyNote:        'Health data is sensitive PII. Access logged in journey_audit. Only for clinical/wellness coordination.',
    },
    {
      name:             'export_journey_data',
      tier:             'staff_approval',
      description:      'Export full journey data including session history, habits, health profile — for data portability requests',
      confirmApprovalId: true,
    },

    // ── ADMIN (2) ─────────────────────────────────────────────────────────────
    {
      name:        'bulk_award_milestones',
      tier:        'admin',
      description: 'Bulk-award a milestone to all customers meeting a criteria (e.g. anniversary)',
    },
    {
      name:        'get_journey_analytics',
      tier:        'admin',
      description: 'Full journey analytics: retention, phase funnel, streak distribution, goal completion rates',
    },

    // ── ADMIN_DESTRUCTIVE (1) ─────────────────────────────────────────────────
    {
      name:             'delete_journey_data',
      tier:             'admin_destructive',
      description:      'Permanently delete all journey data for a customer — GDPR right to erasure',
      confirmText:       'DELETE_JOURNEY',
      confirmApprovalId: true,
      safetyNote:        'Permanent: removes journey, goals, habits, milestones, health profile. Cannot be undone. GDPR/PIPEDA compliance required before deletion.',
    },
  ];

  getAll(): JourneyMcpTool[] {
    return [...this.tools];
  }

  get(name: string): JourneyMcpTool {
    const tool = this.tools.find(t => t.name === name);
    if (!tool) throw new Error(`JourneyMcpTool "${name}" not found`);
    return tool;
  }

  byTier(tier: McpTier): JourneyMcpTool[] {
    return this.tools.filter(t => t.tier === tier);
  }

  execute(name: string, params: Record<string, unknown>): ExecuteResult {
    if (!name?.trim()) throw new Error('tool name is required');
    const tool = this.get(name);

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
