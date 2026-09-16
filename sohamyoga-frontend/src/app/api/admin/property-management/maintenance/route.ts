import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { searchParams } = new URL(req.url);
      const priority = searchParams.get('priority');
      const status = searchParams.get('status');
      const conditions: string[] = [];
      const vals: unknown[] = [];
      if (priority) { vals.push(priority); conditions.push(`m.priority=$${vals.length}`); }
      if (status) { vals.push(status); conditions.push(`m.status=$${vals.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await client.query(`
        SELECT m.*, p.address, t.first_name, t.last_name
        FROM pm_maintenance m
        LEFT JOIN pm_property p ON p.id=m.property_id
        LEFT JOIN pm_tenant t ON t.id=m.tenant_id
        ${where}
        ORDER BY CASE m.priority WHEN 'emergency' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, m.reported_at DESC
      `, vals);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { property_id, tenant_id, issue_type, description, priority = 'medium', status = 'open', assigned_contractor, estimated_cost } = body;
    if (!property_id || !issue_type || !description) {
      return Response.json({ error: 'property_id, issue_type, description required' }, { status: 400 });
    }
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO pm_maintenance (property_id, tenant_id, issue_type, description, priority, status, assigned_contractor, estimated_cost)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
      `, [property_id, tenant_id || null, issue_type, description, priority, status, assigned_contractor || null, estimated_cost || null]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
