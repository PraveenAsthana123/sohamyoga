export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM consulting_upsell_playbooks ORDER BY success_rate DESC');
    return Response.json({ playbooks: rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const b = await req.json().catch(() => null);
    if (!b || !b.trigger_event) return Response.json({ error: 'trigger_event required' }, { status: 400 });
    const { rows } = await client.query(
      `INSERT INTO consulting_upsell_playbooks (trigger_event,offer,script,success_rate) VALUES ($1,$2,$3,$4) RETURNING *`,
      [b.trigger_event, b.offer || null, b.script || null, b.success_rate || 0]
    );
    return Response.json({ playbook: rows[0] }, { status: 201 });
  } finally { client.release(); }
}
