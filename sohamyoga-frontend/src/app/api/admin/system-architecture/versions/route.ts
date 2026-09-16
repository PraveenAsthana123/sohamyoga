import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT * FROM version_registry ORDER BY released_at DESC'
    );
    return NextResponse.json({ versions: result.rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ version: result.rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
