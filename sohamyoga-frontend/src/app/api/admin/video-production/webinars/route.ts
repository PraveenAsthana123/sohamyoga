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

    let query = 'SELECT * FROM webinars WHERE 1=1';
    const params: string[] = [];
    if (status) {
      query += ' AND status = $1';
      params.push(status);
    }
    query += ' ORDER BY scheduled_at ASC';

    const result = await pool.query(query, params);
    return Response.json({ webinars: result.rows });
  } catch (err) {
    console.error('[webinars GET]', err);
    return Response.json({ error: 'Failed to fetch webinars' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const pool = getPool();
    const body = await req.json() as {
      title: string;
      description?: string;
      host_name?: string;
      platform?: string;
      scheduled_at?: string;
      duration_minutes?: number;
      capacity?: number;
      agenda_json?: unknown[];
    };

    const result = await pool.query(
      `INSERT INTO webinars (title, description, host_name, platform, scheduled_at, duration_minutes, capacity, agenda_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        body.title,
        body.description || null,
        body.host_name || null,
        body.platform || 'zoom',
        body.scheduled_at || null,
        body.duration_minutes || 60,
        body.capacity || null,
        JSON.stringify(body.agenda_json || []),
      ]
    );
    return Response.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('[webinars POST]', err);
    return Response.json({ error: 'Failed to create webinar' }, { status: 500 });
  }
}
