export type McpTier =
  | 'auto'
  | 'staff'
  | 'customer_confirm'
  | 'staff_approval'
  | 'admin'
  | 'admin_destructive';

export interface McpTool {
  name: string;
  tier: McpTier;
  description: string;
  confirmText?: string;
  confirmApprovalId?: true;
  safetyNote?: string;
}

const TOOLS: McpTool[] = [
  // auto (2)
  { name: 'get_branch_info',
    tier: 'auto', description: 'Retrieve branch details and status' },
  { name: 'search_corporate_programs',
    tier: 'auto', description: 'Search active corporate wellness programs' },

  // staff (5)
  { name: 'create_branch',
    tier: 'staff', description: 'Create a new branch location' },
  { name: 'update_branch',
    tier: 'staff', description: 'Update branch details or capacity' },
  { name: 'create_corporate_program',
    tier: 'staff', description: 'Create a new corporate wellness program' },
  { name: 'update_white_label',
    tier: 'staff', description: 'Update white-label branding configuration' },
  { name: 'invite_franchisee',
    tier: 'staff', description: 'Send franchise invitation to a prospective tenant' },

  // customer_confirm (1)
  { name: 'accept_franchise_terms',
    tier: 'customer_confirm', description: 'Franchisee accepts agreement terms',
    confirmText: 'ACCEPT_TERMS' },

  // staff_approval (2)
  { name: 'approve_branch_setup',
    tier: 'staff_approval', description: 'Approve a pending branch setup',
    confirmApprovalId: true,
    safetyNote: 'Branch activation triggers tenant provisioning and billing — verify all setup docs first' },
  { name: 'export_franchise_data',
    tier: 'staff_approval', description: 'Export franchise agreement and royalty data',
    confirmApprovalId: true,
    safetyNote: 'Exports contain financial PII — PIPEDA Section 7 applies; log access in audit trail' },

  // admin (2)
  { name: 'activate_white_label',
    tier: 'admin', description: 'Activate white-label branding config for a tenant' },
  { name: 'suspend_branch',
    tier: 'admin', description: 'Suspend an active branch and restrict access' },

  // admin_destructive (1)
  { name: 'terminate_franchise_agreement',
    tier: 'admin_destructive', description: 'Permanently terminate a franchise agreement',
    confirmText: 'TERMINATE_AGREEMENT', confirmApprovalId: true,
    safetyNote: 'Termination triggers immediate access revocation and billing stop — irreversible' },
];

export class EnterpriseMcpRegistry {
  getAll(): McpTool[] {
    return [...TOOLS];
  }

  get(name: string): McpTool {
    const tool = TOOLS.find(t => t.name === name);
    if (!tool) throw new Error(`Tool "${name}" not found`);
    return tool;
  }

  byTier(tier: McpTier): McpTool[] {
    return TOOLS.filter(t => t.tier === tier);
  }

  execute(
    name: string,
    params: Record<string, unknown>,
  ): { tool: McpTool; params: Record<string, unknown> } {
    if (!name.trim()) throw new Error('tool name is required');
    const tool = this.get(name);

    if (tool.confirmText !== undefined && params['confirmText'] === undefined)
      throw new Error(`confirmText is required for "${name}"`);
    if (tool.confirmText !== undefined && params['confirmText'] !== tool.confirmText)
      throw new Error(`confirmText must be "${tool.confirmText}"`);
    if (tool.confirmApprovalId && !params['confirmApprovalId'])
      throw new Error(`confirmApprovalId is required for "${name}"`);

    return { tool, params };
  }
}
