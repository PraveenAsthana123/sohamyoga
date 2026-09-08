import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Lead Detail Screen -- campaign_lead is referenced by opportunity,
// proposal, contract, drip_enrollment, and event_registration, but no
// single view ever aggregated them; the Leads tab only showed a flat table
// row. This is a real read-aggregation across those tables, no fabricated
// data.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const [lead, opportunities, proposals, contracts, driveEnrollments, eventRegs] = await Promise.all([
    query<{
      id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null;
      source_platform: string | null; funnel_stage: string; lead_score: number | null; lead_temperature: string | null;
      assigned_to: string | null; sla_deadline: string | null; service_interest: string | null;
      subject: string | null; message: string | null; created_at: string; duplicate_of_lead_id: string | null;
    }>(
      `SELECT id, first_name, last_name, email, phone, source_platform, funnel_stage, lead_score, lead_temperature,
              assigned_to, sla_deadline, service_interest, subject, message, created_at, duplicate_of_lead_id
       FROM campaign_lead WHERE id = $1`,
      [id],
    ),
    query(`SELECT id, title, estimated_value, currency, stage, probability_pct, expected_close_date FROM opportunity WHERE lead_id = $1 ORDER BY created_at DESC`, [id]),
    query(`SELECT id, title, amount, currency, status, created_at FROM proposal WHERE lead_id = $1 ORDER BY created_at DESC`, [id]),
    query(`SELECT id, status, created_at FROM contract WHERE lead_id = $1 ORDER BY created_at DESC`, [id]),
    query(`SELECT id, status, enrolled_at FROM drip_enrollment WHERE lead_id = $1 ORDER BY enrolled_at DESC`, [id]),
    query(`SELECT id, event_id, registered_at FROM event_registration WHERE lead_id = $1 ORDER BY registered_at DESC`, [id]),
  ]);

  if (!lead.rowCount) return Response.json({ error: 'Lead not found.' }, { status: 404 });
  const l = lead.rows[0];

  return Response.json({
    id: l.id, name: [l.first_name, l.last_name].filter(Boolean).join(' ') || null, email: l.email, phone: l.phone,
    source: l.source_platform, funnelStage: l.funnel_stage, score: l.lead_score, temperature: l.lead_temperature,
    assignedTo: l.assigned_to, slaDeadline: l.sla_deadline, serviceInterest: l.service_interest,
    subject: l.subject, message: l.message, createdAt: l.created_at, duplicateOfLeadId: l.duplicate_of_lead_id,
    opportunities: opportunities.rows, proposals: proposals.rows, contracts: contracts.rows,
    dripEnrollments: driveEnrollments.rows, eventRegistrations: eventRegs.rows,
  });
}
