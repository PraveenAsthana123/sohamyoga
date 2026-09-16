import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const { rows } = await pool.query(
    'SELECT * FROM b2b_portal_integration ORDER BY portal_name ASC'
  );
  return Response.json({ portals: rows });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  try {
    const body = await req.json() as {
      id: number;
      connected?: boolean;
      status?: string;
      credits_remaining?: number;
    };

    if (!body.id) {
      return Response.json({ error: 'id is required' }, { status: 400 });
    }

    const setClauses: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let idx = 1;

    if (typeof body.connected === 'boolean') {
      setClauses.push(`connected=$${idx++}`);
      values.push(body.connected);
      setClauses.push(`status=$${idx++}`);
      values.push(body.connected ? 'connected' : 'available');
    }
    if (body.status !== undefined) {
      setClauses.push(`status=$${idx++}`);
      values.push(body.status);
    }
    if (body.credits_remaining !== undefined) {
      setClauses.push(`credits_remaining=$${idx++}`);
      values.push(body.credits_remaining);
    }

    if (!setClauses.length) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    setClauses.push(`updated_at=NOW()`);
    values.push(body.id);

    const { rows } = await pool.query(
      `UPDATE b2b_portal_integration SET ${setClauses.join(', ')} WHERE id=$${idx} RETURNING *`,
      values
    );

    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ portal: rows[0] });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
