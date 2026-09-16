import { AFFILIATE_COOKIE, ATTRIBUTION_SECONDS } from '@/domain/referral/AffiliateLedger';
import { NextRequest, NextResponse } from 'next/server';
import { databaseConfigured, transaction } from '@/lib/postgres';
import { affiliateDestination } from '@/domain/referral/AffiliateDestination';
import { isIP } from 'node:net';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Count eligible clicks atomically and persist their event in the same transaction. */
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const { code } = params;
  const fallback = () => NextResponse.redirect(new URL('/customer/register', req.url));
  if (!databaseConfigured()) return fallback();

  const referral = await transaction(async client => {
    const result = await client.query<{ id: string; destination_path: string | null }>(
      `UPDATE referral_code SET click_count = click_count + 1, updated_at = now()
       WHERE code = $1 AND status = 'active'
         AND (expires_at IS NULL OR expires_at > now())
         AND (max_uses IS NULL OR used_count < max_uses)
       RETURNING id, destination_path`, [code],
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    const rawIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const click = await client.query<{id:string}>(
      `INSERT INTO referral_click (referral_code_id, ip_address, user_agent, channel, clicked_at)
       VALUES ($1, $2, $3, $4, now()) RETURNING id`,
      [row.id, rawIp && isIP(rawIp) ? rawIp : null, req.headers.get('user-agent') || null, 'direct_link'],
    );
    return { ...row, clickId: click.rows[0].id };
  });
  // Invalid, paused, revoked, expired and exhausted links cannot supply attribution.
  if (!referral) return fallback();
  const destination = affiliateDestination(referral.destination_path, req.url)
    ?? new URL('/customer/register', req.url);
  destination.searchParams.set('ref', code);
  const response = NextResponse.redirect(destination);
  response.cookies.set(AFFILIATE_COOKIE, referral.clickId, { httpOnly:true, secure:new URL(req.url).protocol==='https:', sameSite:'lax', path:'/', maxAge:ATTRIBUTION_SECONDS });
  return response;
}
