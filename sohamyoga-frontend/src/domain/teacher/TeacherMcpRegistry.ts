// Wave 18: Teacher Management — MCP Tool Registry
// API-driven: 13 tools covering the full teacher management API surface
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

export class TeacherMcpRegistry {
  private readonly tools: McpTool[] = [
    // ── AUTO (2) ─────────────────────────────────────────────────────────────
    { name: 'get_teacher_directory',    tier: 'auto',  description: 'Get public teacher directory: name, styles, languages, experience (no PII)' },
    { name: 'get_teacher_schedule',     tier: 'auto',  description: 'Get teacher availability schedule — public calendar for booking' },

    // ── STAFF (5) ────────────────────────────────────────────────────────────
    { name: 'get_teacher_profile',      tier: 'staff', description: 'Get full teacher profile including employment type, hourly rate, certifications' },
    { name: 'update_teacher_status',    tier: 'staff', description: 'Update teacher status: activate, suspend, set on_leave, return from leave' },
    { name: 'add_certification',        tier: 'staff', description: 'Add or update a teacher certification (RYT, CPR, insurance)' },
    { name: 'get_performance_report',   tier: 'staff', description: 'Get teacher performance report: ratings, attendance, cancellation, retention' },
    { name: 'assign_substitute',        tier: 'staff', description: 'Assign a substitute teacher to a class via Flowable workflow' },

    // ── CUSTOMER_CONFIRM (1) ─────────────────────────────────────────────────
    { name: 'book_private_session',     tier: 'customer_confirm', description: 'Book a private 1-on-1 session with a teacher — customer must confirm', confirmText: 'BOOK_PRIVATE' },

    // ── STAFF_APPROVAL (2) ───────────────────────────────────────────────────
    { name: 'get_payroll_data',         tier: 'staff_approval', description: 'Access teacher payroll, commission, and earnings data from ERPNext', confirmApprovalId: true, safetyNote: 'Payroll data is sensitive financial PII — access logged in audit trail; PIPEDA Section 7 applies' },
    { name: 'export_teacher_data',      tier: 'staff_approval', description: 'Export full teacher profile, performance, and payroll as structured JSON', confirmApprovalId: true, safetyNote: 'Export includes sensitive PII (payroll, health clearances) — de-identify before external sharing' },

    // ── ADMIN (2) ────────────────────────────────────────────────────────────
    { name: 'set_commission_rate',      tier: 'admin', description: 'Set or update commission percentage for a teacher' },
    { name: 'bulk_performance_report',  tier: 'admin', description: 'Generate performance analytics across all teachers for a given period' },

    // ── ADMIN_DESTRUCTIVE (1) ────────────────────────────────────────────────
    { name: 'delete_teacher_profile',   tier: 'admin_destructive', description: 'Permanently delete teacher profile, certifications, and performance records', confirmText: 'DELETE_TEACHER', confirmApprovalId: true, safetyNote: 'Irreversible — deletes payroll history, certifications, and all records; GDPR right-to-erasure only' },
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
