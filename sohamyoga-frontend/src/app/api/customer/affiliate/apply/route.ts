import { NextRequest } from 'next/server';
import { getCustomerPrincipal } from '@/lib/customer-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await getCustomerPrincipal(req);
  if (auth.denied) return auth.denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const { name, email, website, social_handles, niche, audience_size, application_notes } = body;

  if (!name || !email) {
    return Response.json({ error: 'Name and email are required.' }, { status: 400 });
  }

  // Check if already applied
  const existing = await query(`SELECT id, status FROM affiliate_partner WHERE email = $1 LIMIT 1`, [email]);
  if (existing.rowCount) {
    const status = existing.rows[0].status;
    return Response.json({
      ok: false,
      already_exists: true,
      status,
      message: status === 'pending'
        ? 'You already have a pending application.'
        : status === 'approved'
          ? 'You are already an approved affiliate partner.'
          : `Your application status is: ${status}.`,
    }, { status: 409 });
  }

  await query(`
    INSERT INTO affiliate_partner (name, email, website, social_handles, niche, audience_size, application_notes, status, tier, commission_rate_bps)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'pending','bronze',1000)
  `, [
    name,
    email,
    website || null,
    JSON.stringify(social_handles || {}),
    niche || null,
    audience_size || 0,
    application_notes || null,
  ]);

  return Response.json({
    ok: true,
    message: 'Application submitted successfully. We will review it within 2 business days.',
  }, { status: 201 });
}
