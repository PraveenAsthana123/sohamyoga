export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM consulting_opportunities WHERE id=$1', [params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const b = await req.json().catch(() => null);
    if (!b || !b.requirements) return Response.json({ error: 'requirements required' }, { status: 400 });
    const current = rows[0].requirements || [];
    let updated: unknown[];
    if (b.action === 'replace') {
      updated = b.requirements;
    } else {
      // append or update
      const existing = Array.isArray(current) ? current : [];
      if (Array.isArray(b.requirements)) {
        updated = [...existing, ...b.requirements];
      } else {
        updated = [...existing, b.requirements];
      }
    }
    const { rows: updatedRows } = await client.query(
      'UPDATE consulting_opportunities SET requirements=$1 WHERE id=$2 RETURNING *',
      [JSON.stringify(updated), params.id]
    );
    return Response.json({ opportunity: updatedRows[0] });
  } finally { client.release(); }
}
