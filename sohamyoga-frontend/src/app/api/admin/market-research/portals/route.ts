export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

interface PortalRow {
  id: number;
  portal_name: string;
  category: string;
  website_url: string | null;
  api_key_env: string | null;
  connected: boolean;
  pricing_model: string;
  monthly_cost_usd: number;
  features: string[];
  use_cases: string[];
  data_freshness: string | null;
  coverage: string | null;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// GET /api/admin/market-research/portals?category=seo_content
export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');

  let query = 'SELECT * FROM market_research_portal';
  const params: string[] = [];

  if (category && category !== 'all') {
    query += ' WHERE category = $1';
    params.push(category);
  }

  query += ' ORDER BY category, portal_name';

  const result = await pool.query<PortalRow>(query, params);

  const connected = result.rows.filter(r => r.connected).length;
  const freeAvailable = result.rows.filter(r => r.pricing_model === 'free' && !r.connected).length;

  return NextResponse.json({
    portals: result.rows,
    summary: {
      total: result.rows.length,
      connected,
      freeAvailable,
    },
  });
}

// PATCH /api/admin/market-research/portals
// body: { id: number; connected: boolean }
export async function PATCH(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const body = (await req.json()) as { id?: number; connected?: boolean };
  const { id, connected } = body;

  if (typeof id !== 'number' || typeof connected !== 'boolean') {
    return NextResponse.json({ error: 'id (number) and connected (boolean) required' }, { status: 400 });
  }

  await pool.query(
    'UPDATE market_research_portal SET connected = $1, updated_at = NOW() WHERE id = $2',
    [connected, id],
  );

  return NextResponse.json({ ok: true });
}
