import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Real pending referral_reward rows for the /admin/referral "Rewards" tab. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const result = await query<{
    id: string; referral_id: string; type: string; value: string; referrer_name: string | null;
    campaign_name: string | null; fraud_flags: string[];
  }>(
    `SELECT rr.id, rr.referral_id, rr.type, rr.value,
            COALESCE(c.display_name, s.display_name, tp.first_name || ' ' || tp.last_name) AS referrer_name,
            rc.name AS campaign_name, rm.fraud_flags
     FROM referral_reward rr
     JOIN referral_master rm ON rm.id = rr.referral_id
     LEFT JOIN customer c ON c.id = rr.referrer_id
     LEFT JOIN student s ON s.id = rr.referrer_id
     LEFT JOIN teacher_profile tp ON tp.id = rr.referrer_id
     LEFT JOIN referral_code rcd ON rcd.id = rm.referral_code_id
     LEFT JOIN referral_campaign rc ON rc.id = rcd.campaign_id
     WHERE rr.status = 'pending'
     ORDER BY rr.created_at ASC
     LIMIT 100`,
  );

  return Response.json({
    rewards: result.rows.map(r => ({
      id: r.id,
      referral: r.referral_id,
      referrer: r.referrer_name ?? 'Unknown',
      type: r.type,
      value: Number(r.value),
      campaign: r.campaign_name,
      flags: r.fraud_flags ?? [],
    })),
  });
}
