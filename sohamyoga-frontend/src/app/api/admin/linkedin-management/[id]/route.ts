import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const { rows } = await pool.query('SELECT * FROM linkedin_post WHERE id=$1', [id]);
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ post: rows[0] });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    const body = await req.json() as Record<string, string | number | boolean | null>;
    const allowed = [
      'title', 'content', 'post_type', 'status', 'scheduled_at',
      'target_audience', 'hashtags', 'media_url', 'ai_generated',
      'reach', 'impressions', 'likes', 'comments', 'shares', 'clicks', 'engagement_rate',
    ];

    const setClauses: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in body) {
        setClauses.push(`${key}=$${idx++}`);
        values.push(body[key]);
      }
    }

    if (!setClauses.length) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    setClauses.push(`updated_at=NOW()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE linkedin_post SET ${setClauses.join(', ')} WHERE id=$${idx} RETURNING *`,
      values
    );

    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ post: rows[0] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const { rowCount } = await pool.query('DELETE FROM linkedin_post WHERE id=$1', [id]);
  if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
