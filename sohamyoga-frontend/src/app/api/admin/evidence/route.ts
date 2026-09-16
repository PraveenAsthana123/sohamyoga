import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const [records, byType, bySubject] = await Promise.all([
    query(`SELECT * FROM evidence_record WHERE tenant_id = $1 ORDER BY collected_at DESC LIMIT 100`, [tenantId]),
    query<{ evidence_type: string; n: string }>(`SELECT evidence_type, count(*)::text AS n FROM evidence_record WHERE tenant_id = $1 GROUP BY evidence_type`, [tenantId]),
    query<{ subject_type: string; n: string }>(`SELECT subject_type, count(*)::text AS n FROM evidence_record WHERE tenant_id = $1 GROUP BY subject_type`, [tenantId]),
  ]);

  return Response.json({
    total: records.rowCount,
    records: records.rows,
    byType: Object.fromEntries(byType.rows.map((r) => [r.evidence_type, Number(r.n)])),
    bySubjectType: Object.fromEntries(bySubject.rows.map((r) => [r.subject_type, Number(r.n)])),
  });
}

const VALID_EVIDENCE_TYPES = ['FACT', 'ESTIMATE', 'INFERENCE', 'HYPOTHESIS', 'UNKNOWN'];
const VALID_CONFIDENCE = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    subject_type?: string;
    subject_id?: string;
    evidence_type?: string;
    claim?: string;
    confidence?: string;
    source_type?: string;
    source_ref?: string;
  } | null;

  if (!body?.subject_type || !body?.subject_id || !body?.claim || !body?.source_type || !body?.source_ref) {
    return Response.json({ error: 'subject_type, subject_id, claim, source_type, source_ref are required.' }, { status: 400 });
  }
  if (body.evidence_type && !VALID_EVIDENCE_TYPES.includes(body.evidence_type)) {
    return Response.json({ error: `evidence_type must be one of ${VALID_EVIDENCE_TYPES.join('|')}` }, { status: 400 });
  }
  if (body.confidence && !VALID_CONFIDENCE.includes(body.confidence)) {
    return Response.json({ error: `confidence must be one of ${VALID_CONFIDENCE.join('|')}` }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO evidence_record
         (tenant_id, subject_type, subject_id, evidence_type, claim, confidence, source_type, source_ref, created_by)
       VALUES ($1, $2, $3::uuid, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        tenantId,
        body.subject_type,
        body.subject_id,
        body.evidence_type ?? 'UNKNOWN',
        body.claim,
        body.confidence ?? 'UNKNOWN',
        body.source_type,
        body.source_ref,
        principal?.id ?? 'admin',
      ],
    );
    return Response.json({ record: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
