import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT r.id, r.reviewer_name, r.star_rating, r.comment, r.review_created_at, r.reply_text, r.reply_updated_at
     FROM business_review r
     JOIN google_business_connection c ON c.id = r.connection_id
     WHERE c.tenant_id = $1 ORDER BY r.review_created_at DESC NULLS LAST LIMIT 200`,
    [tenantId],
  );
  return Response.json({
    reviews: rows.rows.map(r => ({
      id: r.id, reviewerName: r.reviewer_name, starRating: r.star_rating, comment: r.comment,
      createdAt: r.review_created_at, replyText: r.reply_text, replyUpdatedAt: r.reply_updated_at,
    })),
  });
}
