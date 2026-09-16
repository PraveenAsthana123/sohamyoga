import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { controlId: string } }
): Promise<Response> {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT * FROM security_controls_registry WHERE control_id = $1`,
      [params.controlId]
    );
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ control: rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { controlId: string } }
): Promise<Response> {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json();
  const { implementation_status, evidence, last_tested, priority } = body;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE security_controls_registry
       SET implementation_status = COALESCE($1, implementation_status),
           evidence = COALESCE($2, evidence),
           last_tested = COALESCE($3::DATE, last_tested),
           priority = COALESCE($4, priority)
       WHERE control_id = $5
       RETURNING *`,
      [implementation_status, evidence, last_tested || null, priority, params.controlId]
    );
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ control: rows[0] });
  } finally {
    client.release();
  }
}
