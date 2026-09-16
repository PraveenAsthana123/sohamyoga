import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  try {
    const { rows } = await pool.query(`SELECT * FROM digital_cards WHERE id = $1`, [params.id]);
    if (!rows.length) return Response.json({ error: 'Card not found.' }, { status: 404 });

    const [links, viewStats] = await Promise.all([
      pool.query(`SELECT * FROM digital_card_links WHERE card_id = $1 ORDER BY order_index`, [params.id]),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE action = 'view') AS total_views,
          COUNT(*) FILTER (WHERE action = 'contact_click') AS total_contact_clicks,
          COUNT(*) FILTER (WHERE action = 'social_click') AS total_social_clicks,
          COUNT(*) FILTER (WHERE action = 'save_contact') AS total_saves,
          COUNT(*) FILTER (WHERE action = 'share') AS total_shares,
          COUNT(*) FILTER (WHERE action = 'qr_scan') AS total_qr_scans,
          COUNT(*) FILTER (WHERE device_type = 'mobile') AS mobile_views,
          COUNT(*) FILTER (WHERE device_type = 'desktop') AS desktop_views
        FROM digital_card_views
        WHERE card_id = $1
      `, [params.id]),
    ]);

    return Response.json({ card: rows[0], links: links.rows, stats: viewStats.rows[0] });
  } catch (err) {
    console.error('[digital-cards/[id] GET]', err);
    return Response.json({ error: 'Failed to load card.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });

    const updatableFields = [
      'card_type', 'owner_name', 'job_title', 'company_name', 'tagline', 'bio',
      'profile_photo_url', 'cover_photo_url', 'email', 'phone', 'whatsapp_number', 'website_url',
      'city', 'country', 'linkedin_url', 'twitter_url', 'instagram_url', 'facebook_url',
      'youtube_url', 'tiktok_url', 'github_url', 'pinterest_url', 'snapchat_url', 'threads_url',
      'calendly_url', 'zoom_link', 'google_meet_url', 'shopify_url', 'etsy_url', 'amazon_store_url',
      'theme', 'primary_color', 'secondary_color', 'background_color', 'text_color', 'font_family',
      'layout', 'is_active', 'show_qr_on_card', 'allow_contact_form', 'nfc_enabled',
      'password_protected', 'card_password', 'meta_title', 'meta_description', 'slug'
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const f of updatableFields) {
      if (f in body) {
        setClauses.push(`${f} = $${idx}`);
        values.push(body[f]);
        idx++;
      }
    }
    if (!setClauses.length) return Response.json({ error: 'No updatable fields provided.' }, { status: 400 });
    setClauses.push(`updated_at = NOW()`);
    values.push(params.id);

    const { rows } = await pool.query(
      `UPDATE digital_cards SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!rows.length) return Response.json({ error: 'Card not found.' }, { status: 404 });
    return Response.json({ card: rows[0] });
  } catch (err) {
    console.error('[digital-cards/[id] PATCH]', err);
    return Response.json({ error: 'Failed to update card.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `UPDATE digital_cards SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [params.id]
    );
    if (!rows.length) return Response.json({ error: 'Card not found.' }, { status: 404 });
    return Response.json({ ok: true, message: 'Card deactivated.' });
  } catch (err) {
    console.error('[digital-cards/[id] DELETE]', err);
    return Response.json({ error: 'Failed to deactivate card.' }, { status: 500 });
  }
}
