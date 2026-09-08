import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Service Recovery case list -- a case is auto-opened by
// POST /api/service-reviews whenever a review scores <=2 stars.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT rc.id, rc.status, rc.contact_method, rc.notes, rc.resolved_at, rc.created_at,
            sr.star_rating, sr.comment, sr.reviewer_name, sr.reviewer_email, cs.class_name
     FROM service_recovery_case rc
     JOIN service_review sr ON sr.id = rc.review_id
     JOIN booking b ON b.id = sr.booking_id
     JOIN class_session cs ON cs.id = b.class_session_id
     WHERE rc.tenant_id = $1 ORDER BY rc.created_at DESC`,
    [tenantId],
  );
  return Response.json({
    cases: rows.rows.map(r => ({
      id: r.id, status: r.status, contactMethod: r.contact_method, notes: r.notes, resolvedAt: r.resolved_at,
      createdAt: r.created_at, starRating: r.star_rating, comment: r.comment,
      reviewerName: r.reviewer_name, reviewerEmail: r.reviewer_email, className: r.class_name,
    })),
  });
}
