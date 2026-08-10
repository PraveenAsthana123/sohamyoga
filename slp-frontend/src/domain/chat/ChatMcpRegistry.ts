export type McpTier =
  | 'auto'
  | 'customer_confirm'
  | 'staff'
  | 'staff_approval'
  | 'admin'
  | 'admin_destructive';

export interface McpToolSpec {
  name: string;
  tier: McpTier;
  description: string;
  confirmText?: string;
  confirmApprovalId?: boolean;
  safetyNote?: string;
}

const TOOLS: McpToolSpec[] = [
  // ── AUTO (2) ────────────────────────────────────────────────────────────────
  {
    name: 'get_conversations',
    tier: 'auto',
    description: 'List open conversations with status, channel, and priority summary.',
  },
  {
    name: 'get_bot_status',
    tier: 'auto',
    description: 'Get the active chatbot name, type, and operational status.',
  },

  // ── STAFF (5) ───────────────────────────────────────────────────────────────
  {
    name: 'get_conversation',
    tier: 'staff',
    description: 'Get full conversation detail: messages, tags, and assigned agent.',
  },
  {
    name: 'send_message',
    tier: 'staff',
    description: 'Send a message into a conversation as an agent or bot.',
  },
  {
    name: 'assign_agent',
    tier: 'staff',
    description: 'Assign or transfer a conversation to a human agent.',
  },
  {
    name: 'resolve_conversation',
    tier: 'staff',
    description: 'Mark a conversation as resolved.',
  },
  {
    name: 'get_agent_stats',
    tier: 'staff',
    description: 'Get agent online status, current load, and satisfaction scores.',
  },

  // ── CUSTOMER_CONFIRM (1) ────────────────────────────────────────────────────
  {
    name: 'opt_out_chat_history',
    tier: 'customer_confirm',
    description: "Delete the customer's own chat history upon request.",
    confirmText: 'OPT_OUT',
  },

  // ── STAFF_APPROVAL (2) ──────────────────────────────────────────────────────
  {
    name: 'get_conversation_pii',
    tier: 'staff_approval',
    description: 'Access conversation with customer name, email, and contact details.',
    confirmApprovalId: true,
    safetyNote: 'PII access is audit-logged; document legal basis before accessing.',
  },
  {
    name: 'export_conversation',
    tier: 'staff_approval',
    description: 'Export a full conversation transcript for compliance or handoff.',
    confirmApprovalId: true,
  },

  // ── ADMIN (2) ───────────────────────────────────────────────────────────────
  {
    name: 'update_bot_config',
    tier: 'admin',
    description: 'Update chatbot system prompt, model, temperature, or handoff triggers.',
  },
  {
    name: 'get_chat_analytics',
    tier: 'admin',
    description: 'Get CSAT scores, resolution times, conversation volume, and funnel data.',
  },

  // ── ADMIN_DESTRUCTIVE (1) ───────────────────────────────────────────────────
  {
    name: 'delete_conversation_data',
    tier: 'admin_destructive',
    description: 'Permanently delete a conversation and all messages.',
    confirmText: 'DELETE_CONVERSATION',
    confirmApprovalId: true,
    safetyNote:
      'Irreversible — requires GDPR/PIPEDA deletion legal basis and dual confirmation.',
  },
];

export class ChatMcpRegistry {
  private readonly tools: Map<string, McpToolSpec>;

  constructor() {
    this.tools = new Map(TOOLS.map(t => [t.name, t]));
  }

  getAll(): McpToolSpec[] { return [...this.tools.values()]; }

  get(name: string): McpToolSpec {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`tool "${name}" not found`);
    return tool;
  }

  byTier(tier: McpTier): McpToolSpec[] {
    return [...this.tools.values()].filter(t => t.tier === tier);
  }

  execute(
    name: string,
    params: { confirmText?: string; confirmApprovalId?: string; [key: string]: unknown },
  ): { tool: McpToolSpec; params: typeof params } {
    if (!name) throw new Error('tool name is required');
    const tool = this.get(name);

    if (tool.confirmText) {
      if (!params.confirmText)
        throw new Error(`confirmText is required for ${name}`);
      if (params.confirmText !== tool.confirmText)
        throw new Error(`confirmText must be "${tool.confirmText}"`);
    }
    if (tool.confirmApprovalId) {
      if (!params.confirmApprovalId)
        throw new Error(`confirmApprovalId is required for ${name}`);
    }

    return { tool, params };
  }
}
