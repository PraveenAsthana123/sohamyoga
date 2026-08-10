// GET /api/analytics/consent — consent-level distribution for the Consent tab.
// POST /api/analytics/consent — public endpoint the cookie banner calls to
// persist a visitor's choice. Previously ConsentBanner.tsx only wrote to
// localStorage; analytics_consent_record (built, migrated, indexed) had zero
// rows and there was no server-side record of consent ever given, which is
// itself a compliance gap (GDPR/DPDP require being able to demonstrate
// consent was obtained, not just trust the client's local state).

import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { CONSENT_HIERARCHY, type ConsentLevel } from '@/domain/analytics/ConsentRecord';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ConsentBody {
  anonymousId?: string;
  level?: string;
  userId?: string;
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '0.0.0.0';
}

// Append-only log (matches the schema: no unique constraint on anonymous_id,
// CHECK constraints on granted_at/revoked_at ordering) — the *current*
// effective consent for a visitor is always the most recent row.
export async function POST(req: NextRequest) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as ConsentBody | null;
  if (!body?.anonymousId?.trim()) {
    return Response.json({ error: 'anonymousId is required.' }, { status: 400 });
  }
  if (!body.level || !CONSENT_HIERARCHY.includes(body.level as ConsentLevel)) {
    return Response.json({ error: `level must be one of: ${CONSENT_HIERARCHY.join(', ')}` }, { status: 400 });
  }

  const level = body.level as ConsentLevel;
  const granted = level !== 'none';
  const ipHash = createHash('sha256').update(clientIp(req)).digest('hex');
  const userAgent = req.headers.get('user-agent') || 'unknown';

  const result = await query<{ id: string; granted_at: string | null }>(
    `INSERT INTO analytics_consent_record (anonymous_id, user_id, level, granted, granted_at, ip_hash, user_agent)
     VALUES ($1,$2,$3,$4,CASE WHEN $4 THEN now() ELSE NULL END,$5,$6)
     RETURNING id, granted_at`,
    [body.anonymousId.trim(), body.userId?.trim() || null, level, granted, ipHash, userAgent],
  );

  return Response.json({ ok: true, id: result.rows[0].id, level, granted, grantedAt: result.rows[0].granted_at });
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{ level: string; count: string }>(
    `SELECT level::text, COUNT(*) AS count FROM analytics_consent_record
     WHERE granted = TRUE GROUP BY level`,
  );
  const total = rows.rows.reduce((sum, r) => sum + Number(r.count), 0);

  return Response.json({
    distribution: rows.rows.map(r => ({
      level: r.level,
      count: Number(r.count),
      pct: total ? Math.round((Number(r.count) / total) * 100) : 0,
    })),
  });
}
