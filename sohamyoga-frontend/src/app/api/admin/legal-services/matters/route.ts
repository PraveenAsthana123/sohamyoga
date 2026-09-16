export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const lawyer = searchParams.get('lawyer');
  const priority = searchParams.get('priority');
  const overdue = searchParams.get('overdue_deadlines');

  const client = await pool.connect();
  try {
    const where: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (type) { where.push(`lm.matter_type=$${i++}`); params.push(type); }
    if (status) { where.push(`lm.status=$${i++}`); params.push(status); }
    if (lawyer) { where.push(`lm.assigned_lawyer ILIKE $${i++}`); params.push(`%${lawyer}%`); }
    if (priority) { where.push(`lm.priority=$${i++}`); params.push(priority); }
    if (overdue === 'true') { where.push(`(SELECT COUNT(*) FROM legal_deadline WHERE matter_id=lm.id AND deadline_date < CURRENT_DATE AND status='pending') > 0`); }

    const wStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await client.query(`
      SELECT lm.*, lc.name AS client_name,
        (SELECT COUNT(*) FROM legal_deadline WHERE matter_id=lm.id AND status='pending') AS pending_deadlines,
        (SELECT MIN(deadline_date) FROM legal_deadline WHERE matter_id=lm.id AND status='pending') AS next_deadline,
        (SELECT COALESCE(SUM(hours*rate),0) FROM legal_time_entry WHERE matter_id=lm.id AND billed=false) AS unbilled_wip
      FROM legal_matter lm
      LEFT JOIN legal_client lc ON lc.id=lm.client_id
      ${wStr}
      ORDER BY
        CASE lm.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
        lm.created_at DESC
      LIMIT 200
    `, params);

    return Response.json({ matters: rows.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const { client_id, title, matter_type, description, court_file_number, opposing_party,
      assigned_lawyer, assigned_paralegal, status, priority, estimated_hours, disbursements, notes } = body;

    if (!client_id || !title || !matter_type) {
      return Response.json({ error: 'client_id, title, matter_type required' }, { status: 400 });
    }

    // Auto-generate matter number
    const countR = await client.query(`SELECT COUNT(*)+1 AS n FROM legal_matter`);
    const matterNumber = `${new Date().getFullYear()}-${String(countR.rows[0].n).padStart(3,'0')}`;

    const r = await client.query(`
      INSERT INTO legal_matter (client_id,matter_number,title,matter_type,description,court_file_number,opposing_party,
        assigned_lawyer,assigned_paralegal,status,priority,estimated_hours,disbursements,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
    `, [client_id,matterNumber,title,matter_type,description,court_file_number,opposing_party,
        assigned_lawyer,assigned_paralegal,status||'open',priority||'normal',estimated_hours,disbursements||0,notes]);

    return Response.json({ matter: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
