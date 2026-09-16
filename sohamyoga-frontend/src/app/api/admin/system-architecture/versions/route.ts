import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const result = await pool.query(
      'SELECT * FROM version_registry ORDER BY released_at DESC LIMIT 500'
    );
    return Response.json({ versions: result.rows });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json() as {
      version_string: string;
      release_type: string;
      summary: string;
      changes_count?: number;
      modules_changed?: string;
      breaking_changes?: boolean;
      git_commit_hash?: string;
    };
    const result = await pool.query(
      `INSERT INTO version_registry (version_string, release_type, summary, changes_count, modules_changed, breaking_changes, git_commit_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        body.version_string,
        body.release_type,
        body.summary,
        body.changes_count ?? 0,
        body.modules_changed ?? null,
        body.breaking_changes ?? false,
        body.git_commit_hash ?? null,
      ]
    );
    return Response.json({ version: result.rows[0] }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
