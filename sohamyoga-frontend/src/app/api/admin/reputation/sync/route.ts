import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { getValidAccessToken } from '@/domain/reputation/reputationCredentialOps';
import { listAccounts, listLocations, fetchReviews, GoogleBusinessApiError } from '@/domain/reputation/GoogleBusinessReviewAdapter';
import { processReview } from '@/domain/reputation/ReviewAutomation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST — real sync: discovers the account/location on first run, fetches
// real reviews from the Google Business Profile API, upserts them. Fails
// closed with the real Google error if the API call fails; never fabricates
// review data.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const accessToken = await getValidAccessToken(tenantId);
  if (!accessToken) {
    return Response.json({ error: 'Google Business Profile is not connected. Save credentials and complete OAuth first.' }, { status: 409 });
  }

  const conn = await query<{ id: string; business_location_id: string | null }>(
    `SELECT id, business_location_id FROM google_business_connection WHERE tenant_id = $1`, [tenantId],
  );
  if (!conn.rows.length) return Response.json({ error: 'No connection found.' }, { status: 409 });
  const connectionId = conn.rows[0].id;
  let locationName = conn.rows[0].business_location_id;

  try {
    if (!locationName) {
      const accounts = await listAccounts(accessToken);
      if (!accounts.length) return Response.json({ error: 'No Google Business accounts found for this credential.' }, { status: 404 });
      const locations = await listLocations(accessToken, accounts[0].name);
      if (!locations.length) return Response.json({ error: 'No Google Business locations found for this account.' }, { status: 404 });
      locationName = locations[0].name;
      await query(
        `UPDATE google_business_connection SET business_account_id = $2, business_location_id = $3, location_display_name = $4, updated_at = now() WHERE id = $1`,
        [connectionId, accounts[0].name, locationName, locations[0].title],
      );
    }

    const reviews = await fetchReviews(accessToken, locationName);
    for (const r of reviews) {
      const saved = await query<{id:string}>(
        `INSERT INTO business_review (connection_id, google_review_id, reviewer_name, star_rating, comment, review_created_at, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,now())
         ON CONFLICT (connection_id, google_review_id) DO UPDATE SET
           reviewer_name = EXCLUDED.reviewer_name, star_rating = EXCLUDED.star_rating,
           comment = EXCLUDED.comment, synced_at = now() RETURNING id`,
        [connectionId, r.googleReviewId, r.reviewerName, r.starRating, r.comment, r.createTime],
      );
      await processReview(tenantId,{id:saved.rows[0].id,googleReviewId:r.googleReviewId,reviewerName:r.reviewerName,starRating:r.starRating,comment:r.comment,createdAt:r.createTime});
    }
    await query(`UPDATE google_business_connection SET last_synced_at = now(), updated_at = now() WHERE id = $1`, [connectionId]);

    return Response.json({ ok: true, reviewsSynced: reviews.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = err instanceof GoogleBusinessApiError ? err.status : 502;
    await query(`UPDATE google_business_connection SET last_failure_at = now(), last_failure_message = $2, updated_at = now() WHERE id = $1`, [connectionId, message]);
    return Response.json({ error: message }, { status });
  }
}
