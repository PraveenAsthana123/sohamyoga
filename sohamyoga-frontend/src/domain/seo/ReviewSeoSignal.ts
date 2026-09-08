import { query } from '@/lib/postgres';

export interface ReviewSeoSignal {
  reviewCount: number;
  averageRating: number | null;
}

/** Real "Reviews -> Local SEO" signal: joins the existing real
 * business_review table (synced via Google Business Profile, see
 * src/domain/reputation/) through google_business_connection to this
 * tenant. Returns reviewCount=0/averageRating=null when no reviews have
 * synced yet -- never a fabricated placeholder rating. */
export async function getReviewSeoSignal(tenantId: string): Promise<ReviewSeoSignal> {
  const { rows } = await query<{ count: string; avg: string | null }>(
    `SELECT COUNT(*)::text AS count, AVG(br.star_rating)::text AS avg
       FROM business_review br
       JOIN google_business_connection gbc ON gbc.id = br.connection_id
      WHERE gbc.tenant_id = $1 AND br.star_rating IS NOT NULL`,
    [tenantId]
  );
  return {
    reviewCount: Number(rows[0]?.count ?? 0),
    averageRating: rows[0]?.avg ? Number(rows[0].avg) : null,
  };
}
