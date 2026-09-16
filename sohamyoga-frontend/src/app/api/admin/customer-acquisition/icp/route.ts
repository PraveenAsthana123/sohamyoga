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
    const result = await query(
      `SELECT * FROM icp_profiles ORDER BY is_primary DESC, created_at DESC`
    );
    return Response.json({ profiles: result.rows });
  } catch (err) {
    console.error('[icp] GET error:', err);
    return Response.json({ error: 'Failed to load ICP profiles.' }, { status: 500 });
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
      profile_name, industry, company_size, revenue_range, geography,
      job_titles, pain_points, goals, buying_triggers, objections,
      channels, budget_range, sales_cycle_days, is_primary, ai_summary,
    } = body as Record<string, unknown>;

    if (!profile_name || typeof profile_name !== 'string') {
      return Response.json({ error: 'profile_name is required.' }, { status: 400 });
    }

    // If marking as primary, unset existing primary
    if (is_primary) {
      await query(`UPDATE icp_profiles SET is_primary = false WHERE is_primary = true`);
    }

    const toArr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map(String) : typeof v === 'string' ? [v] : [];

    const result = await query(
      `INSERT INTO icp_profiles
         (profile_name, industry, company_size, revenue_range, geography,
          job_titles, pain_points, goals, buying_triggers, objections,
          channels, budget_range, sales_cycle_days, is_primary, ai_summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        profile_name,
        industry ?? null,
        company_size ?? null,
        revenue_range ?? null,
        geography ?? null,
        toArr(job_titles),
        toArr(pain_points),
        toArr(goals),
        toArr(buying_triggers),
        toArr(objections),
        toArr(channels),
        budget_range ?? null,
        sales_cycle_days ? Number(sales_cycle_days) : null,
        Boolean(is_primary),
        ai_summary ?? null,
      ]
    );

    return Response.json({ ok: true, profile: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[icp] POST error:', err);
    return Response.json({ error: 'Failed to create ICP profile.' }, { status: 500 });
  }
}
