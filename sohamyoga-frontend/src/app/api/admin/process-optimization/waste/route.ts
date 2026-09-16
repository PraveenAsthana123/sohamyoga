export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM waste_findings ORDER BY estimated_cost_usd DESC');
    return Response.json({ waste: r.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.waste_type || !body?.process_name) return Response.json({ error: 'waste_type and process_name required' }, { status: 400 });
  const validTypes = ['Transport','Inventory','Motion','Waiting','Overproduction','Overprocessing','Defects','Skills'];
  if (!validTypes.includes(body.waste_type)) return Response.json({ error: `waste_type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO waste_findings (process_name,waste_type,description,impact,estimated_cost_usd,status,action_plan)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.process_name, body.waste_type, body.description || null,
       body.impact || 'medium', body.estimated_cost_usd || 0,
       body.status || 'identified', body.action_plan || null]
    );
    return Response.json({ finding: r.rows[0] }, { status: 201 });
  } finally { client.release(); }
}
