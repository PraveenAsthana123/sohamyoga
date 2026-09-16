import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const result = await pool.query(
      'SELECT * FROM tech_stack_entry ORDER BY category, name LIMIT 500'
    );
    return Response.json({ entries: result.rows });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json() as {
      category: string;
      name: string;
      version?: string;
      purpose?: string;
      docs_url?: string;
      is_core?: boolean;
      status?: string;
      notes?: string;
    };
    const result = await pool.query(
      `INSERT INTO tech_stack_entry (category, name, version, purpose, docs_url, is_core, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        body.category,
        body.name,
        body.version ?? null,
        body.purpose ?? null,
        body.docs_url ?? null,
        body.is_core ?? false,
        body.status ?? 'active',
        body.notes ?? null,
      ]
    );
    return Response.json({ entry: result.rows[0] }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
