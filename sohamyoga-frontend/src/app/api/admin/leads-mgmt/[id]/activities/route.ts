import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const leadId = parseInt(id);
  const result = await pool.query(
    `SELECT * FROM lead_activity WHERE lead_id=$1 ORDER BY created_at DESC`,
    [leadId],
  );
  return Response.json({ activities: result.rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const leadId = parseInt(id);
  const body = await req.json() as { activity_type?: string; description?: string; outcome?: string; created_by?: string };
  const { activity_type, description, outcome, created_by } = body;

  const result = await pool.query(
    `INSERT INTO lead_activity (lead_id, activity_type, description, outcome, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [leadId, activity_type, description, outcome, created_by],
  );

  // Update last_contact_at on the lead
  await pool.query(`UPDATE lead SET last_contact_at=NOW(), updated_at=NOW() WHERE id=$1`, [leadId]);

  return Response.json({ activity: result.rows[0] });
}
