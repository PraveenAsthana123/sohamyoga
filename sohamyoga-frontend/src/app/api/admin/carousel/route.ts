export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const client = await pool.connect();
  try {
    const carouselsRes = await client.query(`
      SELECT c.*,
        COUNT(cs.id) AS slide_count
      FROM carousel c
      LEFT JOIN carousel_slide cs ON cs.carousel_id = c.id
      GROUP BY c.id
      ORDER BY c.status, c.name
    `);

    const bannerRes = await client.query(`
      SELECT * FROM banner ORDER BY created_at DESC LIMIT 50
    `);

    const analyticsRes = await client.query(`
      SELECT carousel_id, SUM(impressions) as impressions, SUM(clicks) as clicks
      FROM carousel_analytics
      WHERE recorded_at >= NOW() - INTERVAL '30 days'
      GROUP BY carousel_id
    `).catch(() => ({ rows: [] }));

    const summary = {
      total: carouselsRes.rowCount ?? 0,
      active: carouselsRes.rows.filter(r => r.status === 'active').length,
      draft: carouselsRes.rows.filter(r => r.status === 'draft').length,
      totalSlides: carouselsRes.rows.reduce((a, r) => a + Number(r.slide_count ?? 0), 0),
    };

    return NextResponse.json({
      carousels: carouselsRes.rows,
      banners: bannerRes.rows,
      analytics: analyticsRes.rows,
      summary,
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json() as Record<string, unknown>;
  const { name, location, description, autoplay, autoplay_delay, effect } = body;

  if (!name || !location) {
    return NextResponse.json({ error: 'name and location required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO carousel (name, location, description, autoplay, autoplay_delay, effect)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, location, description ?? null, autoplay ?? true, autoplay_delay ?? 5000, effect ?? 'slide']
    );
    return NextResponse.json({ carousel: res.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json() as Record<string, unknown>;
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const allowed = ['name', 'location', 'status', 'description', 'autoplay', 'autoplay_delay',
    'pause_on_hover', 'loop', 'speed', 'effect', 'slides_per_view', 'show_arrows', 'show_dots'];
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) {
      updates.push(`${k} = $${i++}`);
      values.push(v);
    }
  }
  if (!updates.length) return NextResponse.json({ error: 'no valid fields' }, { status: 400 });
  values.push(id);

  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE carousel SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      values
    );
    if (!res.rowCount) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ carousel: res.rows[0] });
  } catch {
    return NextResponse.json({ error: 'carousel table may not have updated_at column — update skipped' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query('DELETE FROM carousel_slide WHERE carousel_id = $1', [id]);
    const res = await client.query('DELETE FROM carousel WHERE id = $1', [id]);
    if (!res.rowCount) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } finally {
    client.release();
  }
}
