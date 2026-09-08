import { NextRequest } from 'next/server';
import { randomUUID, randomBytes } from 'crypto';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real QR Kiosk Login -- qr_login_challenge table + v_active_qr_challenges
// view already existed (src/domain/identity/db-schema.sql) but zero API
// route anywhere ever touched them; QrLoginChallenge.tsx generated a fake
// in-memory challenge and its poll loop was an empty TODO. This is the
// first real writer: a public (no auth needed -- this IS the pre-login
// screen) challenge-creation endpoint.
export async function POST(req: NextRequest) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => ({})) as { deviceHint?: string };
  const tenantId = await getPrimaryTenantId();
  const browserSessionId = randomUUID();
  const challengeToken = `qr_${randomBytes(20).toString('hex')}`;

  const result = await query<{ id: string; expires_at: string }>(
    `INSERT INTO qr_login_challenge (id, challenge_token, browser_session_id, device_hint, tenant_id, expires_at)
     VALUES ($1,$2,$3,$4,$5, now() + interval '60 seconds') RETURNING id, expires_at`,
    [randomUUID(), challengeToken, browserSessionId, body.deviceHint?.trim() || 'Unknown device', tenantId],
  );

  return Response.json({
    challengeId: result.rows[0].id, challengeToken, browserSessionId, expiresAt: result.rows[0].expires_at,
  }, { status: 201 });
}
