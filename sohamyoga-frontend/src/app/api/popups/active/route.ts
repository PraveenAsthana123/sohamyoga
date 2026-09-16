import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest): Promise<Response> {
  try {
    const result = await pool.query(
      `SELECT id, name, type, trigger_type, trigger_value, target_pages,
              headline, body_text, cta_text, cta_url, background_color, text_color,
              show_once, show_after_close_days
       FROM popup_cta WHERE status = 'active'
       ORDER BY created_at DESC`,
    );
    return Response.json({ popups: result.rows });
  } catch {
    // Table may not exist yet — return empty list gracefully
    return Response.json({ popups: [] });
  }
}
