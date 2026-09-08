import { NextRequest, NextResponse } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { ReferralCode, type ReferralCodeProps } from '@/domain/referral/ReferralCode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Real referral-link landing route — makes the codes customers share
 * actually resolve to something, instead of the referral_url column
 * pointing nowhere. Records a real referral_click row (via the real
 * ReferralCode.recordClick() domain method, which enforces
 * active/not-expired/not-maxed-out before counting it), then redirects to
 * registration with the code attached.
 *
 * NOTE: customer registration submit is not yet wired to a real backend
 * call (src/app/customer/register/page.tsx has a literal
 * "// TODO: POST /api/auth/register" stub) — that's a pre-existing gap
 * unrelated to this feature, found while building this. Clicks are
 * recorded for real here; the click→registered→verified referral_master
 * transition can't complete until that registration TODO is resolved
 * separately.
 */
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const { code } = params;
  if (!databaseConfigured()) return NextResponse.redirect(new URL('/customer/register', req.url));

  const row = await query<{
    id: string; referrer_id: string; referrer_type: string; referral_url: string;
    status: string; max_uses: number | null; used_count: number; click_count: number;
    expires_at: string | null; created_at: string; updated_at: string; destination_path: string | null;
  }>(`SELECT * FROM referral_code WHERE code = $1`, [code]);

  if (!row.rowCount) {
    return NextResponse.redirect(new URL('/customer/register', req.url));
  }

  const r = row.rows[0];
  const props: ReferralCodeProps = {
    id: r.id, code, referrerId: r.referrer_id, referrerType: r.referrer_type as ReferralCodeProps['referrerType'],
    referralUrl: r.referral_url, status: r.status as ReferralCodeProps['status'],
    maxUses: r.max_uses ?? undefined, usedCount: r.used_count, clickCount: r.click_count,
    expiresAt: r.expires_at ? new Date(r.expires_at) : undefined,
    createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
  };
  const domainCode = new ReferralCode(props);

  if (domainCode.canBeUsed()) {
    const clicked = domainCode.recordClick();
    await query(`UPDATE referral_code SET click_count = $1, updated_at = $2 WHERE id = $3`, [clicked.clickCount, clicked.updatedAt, r.id]);

    const rawIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const ip = rawIp && /^[0-9a-fA-F:.]+$/.test(rawIp) ? rawIp : null; // basic IPv4/IPv6 shape check — malformed/spoofed header values are stored as NULL rather than failing the redirect
    await query(
      `INSERT INTO referral_click (referral_code_id, ip_address, user_agent, channel, clicked_at)
       VALUES ($1, $2, $3, $4, now())`,
      [r.id, ip, req.headers.get('user-agent') || null, 'direct_link'],
    );
  }

  // Real affiliate-link destination -- previously EVERY code, regardless of
  // referrer_type or its stored destination_path, redirected to
  // /customer/register: correct for a customer-referral code (the point is
  // to bring a new signup), wrong for an affiliate link meant to land a
  // visitor on a specific vendor product/service page. Only a portal-owned
  // relative path is honored (same safety rule as utm_link.base_url) --
  // never an external URL.
  const dest = r.destination_path;
  if (dest && dest.startsWith('/') && !dest.startsWith('//')) {
    const url = new URL(dest, req.url);
    url.searchParams.set('ref', code);
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(`/customer/register?ref=${encodeURIComponent(code)}`, req.url));
}
