// Wave 19: Yoga Library — MCP Tool Registry
// API-driven: 13 tools covering the full yoga library API surface
// 2 auto / 5 staff / 1 customer_confirm / 2 staff_approval / 2 admin / 1 admin_destructive

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

export class YogaMcpRegistry {
  private readonly tools: McpTool[] = [
    // ── AUTO (2) ─────────────────────────────────────────────────────────────
    { name: 'search_asana',           tier: 'auto',  description: 'Search pose library by name, style, body part, difficulty, dosha — public catalog' },
    { name: 'search_meditation',      tier: 'auto',  description: 'Search meditation sessions by style, duration, goal — public catalog' },

    // ── STAFF (5) ────────────────────────────────────────────────────────────
    { name: 'create_asana',           tier: 'staff', description: 'Create a new asana with Sanskrit/English name, difficulty, contraindications' },
    { name: 'update_asana',           tier: 'staff', description: 'Update asana body parts, styles, props, contraindications, goals' },
    { name: 'create_sequence',        tier: 'staff', description: 'Create a new class sequence with ordered asana items and teaching cues' },
    { name: 'create_pranayama',       tier: 'staff', description: 'Create pranayama technique with ratio steps, rounds, and benefits' },
    { name: 'publish_meditation',     tier: 'staff', description: 'Publish a meditation session from draft — makes it visible to students' },

    // ── CUSTOMER_CONFIRM (1) ─────────────────────────────────────────────────
    { name: 'save_to_practice_plan',  tier: 'customer_confirm', description: 'Save asana or sequence to student practice plan — student must confirm', confirmText: 'SAVE_TO_PLAN' },

    // ── STAFF_APPROVAL (2) ───────────────────────────────────────────────────
    { name: 'bulk_import_library',    tier: 'staff_approval', description: 'Bulk import asanas or meditations from external source (JSON/CSV)', confirmApprovalId: true, safetyNote: 'Bulk import overwrites existing entries with matching codes — verify source data quality and licensing before confirming' },
    { name: 'export_library_data',    tier: 'staff_approval', description: 'Export full yoga library (asanas, sequences, pranayama, meditation) as structured JSON', confirmApprovalId: true, safetyNote: 'Export may include proprietary content or teacher IP — verify licensing before redistribution' },

    // ── ADMIN (2) ────────────────────────────────────────────────────────────
    { name: 'publish_sequence_template', tier: 'admin', description: 'Promote a class sequence to a reusable template visible to all studio teachers' },
    { name: 'archive_asana',          tier: 'admin', description: 'Archive an asana — hides from catalog and search; does not delete sequence references' },

    // ── ADMIN_DESTRUCTIVE (1) ────────────────────────────────────────────────
    { name: 'delete_asana',           tier: 'admin_destructive', description: 'Permanently delete asana and remove from all class sequences', confirmText: 'DELETE_ASANA', confirmApprovalId: true, safetyNote: 'Irreversible — removes asana from every sequence that references it; review affected sequences in v_asana_sequence_usage before proceeding' },
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
