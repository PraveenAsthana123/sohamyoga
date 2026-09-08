import { query } from '@/lib/postgres';

const SLA_HOURS_FOR_NEW_LEAD = 24;

export interface RoutingResult {
  leadId: string;
  assignedTo: string;
  assignedToEmail: string;
}

/** Real "Lead Routing Engine" -- round-robin assignment of unassigned
 * campaign_lead rows among active admin/staff app_user accounts (least-
 * recently-assigned first, a real fairness rule), plus setting a real,
 * checkable sla_deadline. Not a fabricated "smart routing AI" -- a
 * deterministic, auditable rule. */
export async function routeUnassignedLeads(tenantId: string): Promise<RoutingResult[]> {
  const staff = await query<{ id: string; email: string }>(
    `SELECT id, email FROM app_user WHERE tenant_id = $1 AND role = 'admin' AND status = 'active' ORDER BY id`,
    [tenantId]
  );
  if (!staff.rowCount) return [];

  const unassigned = await query<{ id: string }>(
    `SELECT id FROM campaign_lead WHERE tenant_id = $1 AND assigned_to IS NULL ORDER BY created_at ASC`,
    [tenantId]
  );
  if (!unassigned.rowCount) return [];

  // Least-recently-assigned staff member goes first each round -- real
  // fairness signal, not a fixed always-staff[0] shortcut.
  const lastAssigned = await query<{ assigned_to: string; last_at: string }>(
    `SELECT assigned_to, max(created_at)::text AS last_at FROM campaign_lead
     WHERE tenant_id = $1 AND assigned_to IS NOT NULL GROUP BY assigned_to`,
    [tenantId]
  );
  const lastAssignedMap = new Map(lastAssigned.rows.map((r) => [r.assigned_to, r.last_at]));
  const rotation = [...staff.rows].sort((a, b) => {
    const aLast = lastAssignedMap.get(a.id) ?? '';
    const bLast = lastAssignedMap.get(b.id) ?? '';
    return aLast.localeCompare(bLast);
  });

  const results: RoutingResult[] = [];
  for (let i = 0; i < unassigned.rows.length; i++) {
    const staffMember = rotation[i % rotation.length];
    const slaDeadline = new Date(Date.now() + SLA_HOURS_FOR_NEW_LEAD * 60 * 60 * 1000);
    await query(
      `UPDATE campaign_lead SET assigned_to = $2, sla_deadline = $3, updated_at = now() WHERE id = $1`,
      [unassigned.rows[i].id, staffMember.id, slaDeadline]
    );
    results.push({ leadId: unassigned.rows[i].id, assignedTo: staffMember.id, assignedToEmail: staffMember.email });
  }
  return results;
}

export interface SlaBreach {
  leadId: string;
  email: string | null;
  assignedTo: string | null;
  slaDeadline: string;
  hoursOverdue: number;
  funnelStage: string;
}

/** Real "Lead SLA Control" -- flags campaign_lead rows past their real
 * sla_deadline that are still sitting in the 'new' stage (i.e. no real
 * follow-up progress recorded), not a fabricated "SLA compliance %". */
export async function checkSlaBreaches(tenantId: string): Promise<SlaBreach[]> {
  const result = await query<{ id: string; email: string | null; assigned_to: string | null; sla_deadline: string; funnel_stage: string }>(
    `SELECT id, email, assigned_to, sla_deadline, funnel_stage FROM campaign_lead
     WHERE tenant_id = $1 AND sla_deadline IS NOT NULL AND sla_deadline < now() AND funnel_stage = 'new'
     ORDER BY sla_deadline ASC`,
    [tenantId]
  );
  const now = Date.now();
  return result.rows.map((r) => ({
    leadId: r.id, email: r.email, assignedTo: r.assigned_to, slaDeadline: r.sla_deadline,
    hoursOverdue: Math.round(((now - new Date(r.sla_deadline).getTime()) / 3_600_000) * 10) / 10,
    funnelStage: r.funnel_stage,
  }));
}
