import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { qualifyTranscript } from '@/domain/voice/VoiceQualification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// No real telephony/Voice AI provider integration exists here -- every
// row is a real, admin-entered transcript of what was actually said,
// never a simulated call. API-only, no dedicated UI page yet.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const tenantId = await getPrimaryTenantId();
  const rows = await query(`SELECT * FROM voice_call_log WHERE tenant_id = $1 ORDER BY call_date DESC LIMIT 100`, [tenantId]);
  return Response.json({ calls: rows.rows });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as { direction?: string; phoneNumber?: string; transcript?: string; durationSeconds?: number } | null;
  if (!body?.direction || !body.transcript) return Response.json({ error: 'direction and transcript are required.' }, { status: 400 });

  const { score, tier } = qualifyTranscript(body.transcript);
  const tenantId = await getPrimaryTenantId();
  const result = await query<{ id: string }>(
    `INSERT INTO voice_call_log (tenant_id, direction, phone_number, transcript, duration_seconds, qualification_score, qualification_tier, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [tenantId, body.direction, body.phoneNumber ?? null, body.transcript, body.durationSeconds ?? null, score, tier, principal?.email ?? 'admin'],
  );
  return Response.json({ id: result.rows[0].id, qualificationScore: score, qualificationTier: tier }, { status: 201 });
}
