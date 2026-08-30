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
  // ── AUTO (1) ────────────────────────────────────────────────────────────────
  {
    name: 'list_sources',
    tier: 'auto',
    description: 'List registered sources and connector catalog with current discovery status.',
  },

  // ── STAFF (2) ───────────────────────────────────────────────────────────────
  {
    name: 'register_chatgpt_source',
    tier: 'staff',
    description: 'Register a chatgpt.com/share/ link as a source and run initial discovery.',
  },
  {
    name: 'run_discovery',
    tier: 'staff',
    description: 'Re-run discovery for an existing source, detecting content changes.',
  },
];

export class IngestionMcpRegistry {
  private readonly tools: Map<string, McpToolSpec>;

  constructor() {
    this.tools = new Map(TOOLS.map(t => [t.name, t]));
  }

  getAll(): McpToolSpec[] { return Array.from(this.tools.values()); }

  get(name: string): McpToolSpec {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`tool "${name}" not found`);
    return tool;
  }

  byTier(tier: McpTier): McpToolSpec[] {
    return Array.from(this.tools.values()).filter(t => t.tier === tier);
  }
}
