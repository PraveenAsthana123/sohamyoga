import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const project_type = searchParams.get('project_type');

    let query = 'SELECT * FROM video_scripts WHERE 1=1';
    const params: string[] = [];
    let idx = 1;

    if (status) {
      query += ` AND status = $${idx++}`;
      params.push(status);
    }
    if (project_type) {
      query += ` AND project_type = $${idx++}`;
      params.push(project_type);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return Response.json({ scripts: result.rows });
  } catch (err) {
    console.error('[scripts GET]', err);
    return Response.json({ error: 'Failed to fetch scripts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const pool = getPool();
    const body = await req.json() as {
      title: string;
      project_type?: string;
      duration_target_seconds?: number;
      tone?: string;
      target_audience?: string;
      call_to_action?: string;
      hook?: string;
      script_body?: string;
      voice_notes?: string;
    };

    const result = await pool.query(
      `INSERT INTO video_scripts (title, project_type, duration_target_seconds, tone, target_audience, call_to_action, hook, script_body, voice_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        body.title,
        body.project_type || 'ad',
        body.duration_target_seconds || 30,
        body.tone || 'professional',
        body.target_audience || null,
        body.call_to_action || null,
        body.hook || null,
        body.script_body || null,
        body.voice_notes || null,
      ]
    );
    return Response.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('[scripts POST]', err);
    return Response.json({ error: 'Failed to create script' }, { status: 500 });
  }
}
