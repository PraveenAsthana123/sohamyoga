import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  const category = searchParams.get('category');
  const priority = searchParams.get('priority');
  const status = searchParams.get('status');
  const slaBreachOnly = searchParams.get('sla_breach');
  const conditions: string[] = [];
  const vals: unknown[] = [];
  if (clientId) { conditions.push(`t.client_id=$${vals.length + 1}`); vals.push(clientId); }
  if (category) { conditions.push(`t.category=$${vals.length + 1}`); vals.push(category); }
  if (priority) { conditions.push(`t.priority=$${vals.length + 1}`); vals.push(priority); }
  if (status) { conditions.push(`t.status=$${vals.length + 1}`); vals.push(status); }
  if (slaBreachOnly === 'true') { conditions.push(`t.sla_breach=true`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT t.*, c.name AS client_name, c.sla_response_hours, c.sla_resolution_hours FROM it_ticket t LEFT JOIN it_client c ON c.id=t.client_id ${where} ORDER BY CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.created_at DESC`,
      vals
    );
    return Response.json({ tickets: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.client_id || !body?.title) return Response.json({ error: 'client_id and title are required.' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Auto-generate ticket number
    const year = new Date().getFullYear();
    const { rows: cnt } = await client.query(`SELECT COUNT(*) AS n FROM it_ticket WHERE EXTRACT(YEAR FROM created_at)=$1`, [year]);
    const ticketNumber = `TKT-${year}-${String(parseInt(cnt[0].n, 10) + 1).padStart(4, '0')}`;
    const { rows } = await client.query(
      `INSERT INTO it_ticket (client_id, ticket_number, title, description, category, priority, status, assigned_to, reported_by, billable)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [body.client_id, ticketNumber, body.title, body.description, body.category, body.priority ?? 'medium', body.status ?? 'open', body.assigned_to, body.reported_by, body.billable ?? false]
    );
    return Response.json({ ticket: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
