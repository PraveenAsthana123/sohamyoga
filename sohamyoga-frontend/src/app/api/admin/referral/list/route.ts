import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Real referral_master rows, most recent first, for the /admin/referral "Referrals" tab. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const result = await query<{
    id: string; referree_email: string; type: string; status: string; channel: string | null;
    order_amount: string | null; created_at: string; referrer_name: string | null; campaign_name: string | null;
  }>(
    `SELECT
       rm.id, rm.referree_email, rm.type, rm.status, rm.channel, rm.order_amount, rm.created_at,
       COALESCE(c.display_name, s.display_name, tp.first_name || ' ' || tp.last_name) AS referrer_name,
       rc.name AS campaign_name
     FROM referral_master rm
     LEFT JOIN customer c ON c.id = rm.referrer_id
     LEFT JOIN student s ON s.id = rm.referrer_id
     LEFT JOIN teacher_profile tp ON tp.id = rm.referrer_id
     LEFT JOIN referral_code rcd ON rcd.id = rm.referral_code_id
     LEFT JOIN referral_campaign rc ON rc.id = rcd.campaign_id
     ORDER BY rm.created_at DESC
     LIMIT 100`,
  );

  return Response.json({
    referrals: result.rows.map(r => ({
      id: r.id,
      referrer: r.referrer_name ?? `${r.id.slice(0, 8)}…`,
      referree: r.referree_email,
      type: r.type,
      status: r.status,
      channel: r.channel,
      amount: r.order_amount ? Number(r.order_amount) : null,
      campaign: r.campaign_name,
      createdAt: r.created_at,
    })),
  });
}
