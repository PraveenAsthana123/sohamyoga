import { NextRequest } from 'next/server';
import { databaseConfigured, getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENSURE_TABLE = `
  CREATE TABLE IF NOT EXISTS customer_click_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT, customer_id UUID, visitor_id TEXT,
    event_type TEXT NOT NULL, page_path TEXT, element_id TEXT,
    element_text TEXT, element_type TEXT, source TEXT, medium TEXT,
    campaign TEXT, referrer_url TEXT, utm_source TEXT, utm_medium TEXT,
    utm_campaign TEXT, utm_content TEXT, utm_term TEXT, device_type TEXT,
    browser TEXT, country TEXT, city TEXT, ip_hash TEXT,
    metadata_json JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    const pool = getPool();
    await pool.query(ENSURE_TABLE);

    const url = new URL(req.url);
    const pagePath = url.searchParams.get('page_path');

    let pagesQuery: string;
    let pagesParams: unknown[] = [];

    if (pagePath) {
      pagesQuery = `
        SELECT page_path, COUNT(*) as clicks,
               json_agg(json_build_object('element_id', element_id, 'element_text', element_text, 'element_type', element_type, 'clicks', elem_count) ORDER BY elem_count DESC) as top_elements
        FROM (
          SELECT page_path, element_id, element_text, element_type, COUNT(*) as elem_count
          FROM customer_click_events
          WHERE page_path = $1 AND element_id IS NOT NULL
          GROUP BY page_path, element_id, element_text, element_type
        ) sub
        GROUP BY page_path
      `;
      pagesParams = [pagePath];
    } else {
      pagesQuery = `
        SELECT page_path, SUM(elem_count) as clicks,
               json_agg(json_build_object('element_id', element_id, 'element_text', element_text, 'element_type', element_type, 'clicks', elem_count) ORDER BY elem_count DESC) FILTER (WHERE rn <= 10) as top_elements
        FROM (
          SELECT page_path, element_id, element_text, element_type, COUNT(*) as elem_count,
                 ROW_NUMBER() OVER (PARTITION BY page_path ORDER BY COUNT(*) DESC) as rn
          FROM customer_click_events
          WHERE element_id IS NOT NULL AND page_path IS NOT NULL
            AND created_at > NOW() - INTERVAL '30 days'
          GROUP BY page_path, element_id, element_text, element_type
        ) sub
        GROUP BY page_path
        ORDER BY clicks DESC
        LIMIT 10
      `;
    }

    const { rows: pages } = await pool.query(pagesQuery, pagesParams);

    // Top 10 pages for dropdown
    const { rows: topPagesList } = await pool.query(
      `SELECT DISTINCT page_path, COUNT(*) as cnt FROM customer_click_events WHERE page_path IS NOT NULL GROUP BY page_path ORDER BY cnt DESC LIMIT 10`,
    );

    return Response.json({ pages, top_pages_list: topPagesList.map(r => r.page_path) });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
