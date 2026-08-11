import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Real referral_code rows for the /admin/referral "Codes" tab. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const result = await query<{
    code: string; referrer_type: string; status: string; click_count: number; used_count: number;
    max_uses: number | null; expires_at: string | null; referrer_name: string | null; campaign_name: string | null;
  }>(
    `SELECT
       rcd.code, rcd.referrer_type, rcd.status, rcd.click_count, rcd.used_count, rcd.max_uses, rcd.expires_at,
       COALESCE(c.display_name, s.display_name, tp.first_name || ' ' || tp.last_name) AS referrer_name,
       rc.name AS campaign_name
     FROM referral_code rcd
     LEFT JOIN customer c ON c.id = rcd.referrer_id
     LEFT JOIN student s ON s.id = rcd.referrer_id
     LEFT JOIN teacher_profile tp ON tp.id = rcd.referrer_id
     LEFT JOIN referral_campaign rc ON rc.id = rcd.campaign_id
     ORDER BY rcd.created_at DESC
     LIMIT 100`,
  );

  return Response.json({
    codes: result.rows.map(c => ({
      code: c.code,
      referrer: c.referrer_name ?? 'Unknown',
      type: c.referrer_type,
      status: c.status,
      clicks: c.click_count,
      uses: c.used_count,
      maxUses: c.max_uses,
      campaign: c.campaign_name,
      expiry: c.expires_at,
    })),
  });
}
