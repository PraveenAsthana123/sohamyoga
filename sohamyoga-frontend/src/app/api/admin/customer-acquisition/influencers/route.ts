import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (platform) {
      conditions.push(`platform = $${values.length + 1}`);
      values.push(platform);
    }
    if (status) {
      conditions.push(`status = $${values.length + 1}`);
      values.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM influencer_roster ${where} ORDER BY status, followers DESC`,
      values
    );
    return Response.json({ influencers: result.rows });
  } catch (err) {
    console.error('[influencers] GET error:', err);
    return Response.json({ error: 'Failed to load influencers.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const {
      name, platform, handle, profile_url, followers, avg_engagement_rate,
      niche, location, email, status, rate_per_post_cad, notes,
    } = body as Record<string, unknown>;

    if (!name || typeof name !== 'string') {
      return Response.json({ error: 'name is required.' }, { status: 400 });
    }

    const toArr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map(String) : typeof v === 'string' ? [v] : [];

    const result = await query(
      `INSERT INTO influencer_roster
         (name, platform, handle, profile_url, followers, avg_engagement_rate,
          niche, location, email, status, rate_per_post_cad, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        name,
        platform ?? null,
        handle ?? null,
        profile_url ?? null,
        followers ? Number(followers) : null,
        avg_engagement_rate ? Number(avg_engagement_rate) : null,
        toArr(niche),
        location ?? null,
        email ?? null,
        status ?? 'prospect',
        rate_per_post_cad ? Number(rate_per_post_cad) : null,
        notes ?? null,
      ]
    );

    return Response.json({ ok: true, influencer: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[influencers] POST error:', err);
    return Response.json({ error: 'Failed to add influencer.' }, { status: 500 });
  }
}
