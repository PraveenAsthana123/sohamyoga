import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_ACTIONS = ['view', 'contact_click', 'social_click', 'save_contact', 'share', 'qr_scan'] as const;
type TrackAction = typeof VALID_ACTIONS[number];

export async function POST(req: NextRequest, { params }: { params: { slug: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });

    const action = body.action as TrackAction;
    if (!VALID_ACTIONS.includes(action)) {
      return Response.json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
    }

    const { rows } = await pool.query('SELECT id FROM digital_cards WHERE slug = $1 AND is_active = true', [params.slug]);
    if (!rows.length) return Response.json({ error: 'Card not found.' }, { status: 404 });

    const cardId = rows[0].id;
    const userAgent = req.headers.get('user-agent') || '';
    const deviceType = body.device_type || (/mobile|android|iphone|ipad/i.test(userAgent) ? 'mobile' : 'desktop');
    const referrer = body.referrer || req.headers.get('referer') || 'direct';
    const elementClicked = typeof body.element_clicked === 'string' ? body.element_clicked : null;

    // Map action to counter column
    const counterMap: Record<TrackAction, string | null> = {
      view: 'view_count',
      contact_click: 'click_count',
      social_click: 'click_count',
      save_contact: 'save_count',
      share: 'share_count',
      qr_scan: 'view_count',
    };
    const counter = counterMap[action];

    const ops: Promise<unknown>[] = [
      pool.query(
        `INSERT INTO digital_card_views (card_id, referrer, device_type, action, element_clicked) VALUES ($1, $2, $3, $4, $5)`,
        [cardId, referrer, deviceType, action, elementClicked]
      ),
    ];
    if (counter) {
      ops.push(pool.query(`UPDATE digital_cards SET ${counter} = ${counter} + 1 WHERE id = $1`, [cardId]));
    }

    // Also increment click_count on custom link if element_clicked is a link id
    if (elementClicked && (action === 'social_click' || action === 'contact_click')) {
      ops.push(
        pool.query(
          `UPDATE digital_card_links SET click_count = click_count + 1 WHERE id = $1 AND card_id = $2`,
          [elementClicked, cardId]
        )
      );
    }

    await Promise.all(ops);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[card/[slug]/track POST]', err);
    return Response.json({ error: 'Failed to track event.' }, { status: 500 });
  }
}
