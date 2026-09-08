import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COMPENSATION_TYPES = ['cash', 'free_class', 'membership', 'commission', 'product', 'none'];

// Real CRUD for influencer_collaboration -- the table existed in schema
// (src/domain/growth/db-schema-influencer.sql) with zero API routes or UI
// referencing it anywhere before this. Closes the collaboration-lifecycle
// gap (brief/negotiation/contract/payment) confirmed absent this session.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const rows = await query(
    `SELECT id, campaign_name, status, deliverables, compensation_type, compensation_value, started_at, completed_at, created_at,
            submitted_content_url, submitted_at, published_content_url, published_at
     FROM influencer_collaboration WHERE influencer_id = $1 ORDER BY created_at DESC`,
    [id],
  );
  return Response.json({
    collaborations: rows.rows.map(r => ({
      id: r.id, campaignName: r.campaign_name, status: r.status, deliverables: r.deliverables,
      compensationType: r.compensation_type, compensationValue: r.compensation_value ? Number(r.compensation_value) : null,
      startedAt: r.started_at, completedAt: r.completed_at, createdAt: r.created_at,
      submittedContentUrl: r.submitted_content_url, submittedAt: r.submitted_at,
      publishedContentUrl: r.published_content_url, publishedAt: r.published_at,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    campaignName?: string; deliverables?: string; compensationType?: string; compensationValue?: number;
  } | null;
  if (!body?.campaignName?.trim()) return Response.json({ error: 'campaignName is required.' }, { status: 400 });
  if (body.compensationType && !COMPENSATION_TYPES.includes(body.compensationType)) {
    return Response.json({ error: `compensationType must be one of: ${COMPENSATION_TYPES.join(', ')}` }, { status: 400 });
  }

  const influencer = await query<{ tenant_id: string }>(`SELECT tenant_id FROM influencer_profile WHERE id = $1`, [id]);
  if (!influencer.rowCount) return Response.json({ error: 'Influencer not found.' }, { status: 404 });

  const result = await query<{ id: string }>(
    `INSERT INTO influencer_collaboration (tenant_id, influencer_id, campaign_name, deliverables, compensation_type, compensation_value)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [influencer.rows[0].tenant_id, id, body.campaignName.trim(), body.deliverables ?? null, body.compensationType ?? null, body.compensationValue ?? null],
  );
  return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}
