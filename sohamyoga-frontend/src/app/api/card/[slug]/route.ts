import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hashIp(ip: string): string {
  // Simple hash without crypto dependency
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT id, slug, card_type, owner_name, job_title, company_name, tagline, bio,
        profile_photo_url, cover_photo_url,
        email, phone, whatsapp_number, website_url, city, country,
        linkedin_url, twitter_url, instagram_url, facebook_url, youtube_url, tiktok_url,
        github_url, pinterest_url, snapchat_url, threads_url,
        calendly_url, zoom_link, google_meet_url, shopify_url, etsy_url, amazon_store_url,
        theme, primary_color, secondary_color, background_color, text_color, font_family, layout,
        view_count, click_count, share_count, save_count,
        is_active, show_qr_on_card, allow_contact_form, nfc_enabled, password_protected,
        meta_title, meta_description, created_at
       FROM digital_cards WHERE slug = $1 AND is_active = true`,
      [params.slug]
    );
    if (!rows.length) return Response.json({ error: 'Card not found.' }, { status: 404 });

    const card = rows[0];

    // Password protection check
    if (card.password_protected) {
      const cookieHeader = req.headers.get('cookie') || '';
      const cardCookie = cookieHeader.split(';').find(c => c.trim().startsWith(`card_auth_${card.id}=`));
      if (!cardCookie) {
        return Response.json({ requires_password: true, slug: card.slug });
      }
    }

    // Get custom links
    const linksResult = await pool.query(
      `SELECT id, label, url, icon, order_index, click_count FROM digital_card_links
       WHERE card_id = $1 AND is_active = true ORDER BY order_index`,
      [card.id]
    );

    // Track view
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const deviceType = /mobile|android|iphone|ipad/i.test(userAgent) ? 'mobile' : 'desktop';
    const referrer = req.headers.get('referer') || req.nextUrl.searchParams.get('utm_source') || 'direct';

    await Promise.all([
      pool.query(
        `INSERT INTO digital_card_views (card_id, viewer_ip_hash, referrer, device_type, action) VALUES ($1, $2, $3, $4, 'view')`,
        [card.id, hashIp(ip), referrer, deviceType]
      ),
      pool.query(`UPDATE digital_cards SET view_count = view_count + 1 WHERE id = $1`, [card.id]),
    ]);

    return Response.json({ card, links: linksResult.rows });
  } catch (err) {
    console.error('[card/[slug] GET]', err);
    return Response.json({ error: 'Failed to load card.' }, { status: 500 });
  }
}
