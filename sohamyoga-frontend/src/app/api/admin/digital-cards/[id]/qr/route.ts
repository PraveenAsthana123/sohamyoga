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
    const { searchParams } = new URL(req.url);
    const size = Math.min(Math.max(parseInt(searchParams.get('size') || '300', 10), 100), 1000);

    const { rows } = await pool.query('SELECT id, slug FROM digital_cards WHERE id = $1', [params.id]);
    if (!rows.length) return Response.json({ error: 'Card not found.' }, { status: 404 });

    const card = rows[0];
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sohamyoga.com';
    const cardUrl = `${baseUrl}/card/${card.slug}`;
    const encodedUrl = encodeURIComponent(cardUrl);
    const qrImageUrl = `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodedUrl}&choe=UTF-8`;

    return Response.json({
      qr_image_url: qrImageUrl,
      card_url: cardUrl,
      slug: card.slug,
      size,
    });
  } catch (err) {
    console.error('[digital-cards/[id]/qr GET]', err);
    return Response.json({ error: 'Failed to generate QR data.' }, { status: 500 });
  }
}
