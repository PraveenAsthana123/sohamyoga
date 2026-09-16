// TrustpilotReviewSyncJob — every 6 hours
// Fetches latest Trustpilot reviews via Business API, inserts new ones into
// reputation_review table, and flags low-rating reviews as needing urgent response.
// Creates the reputation_review table if it does not yet exist.
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface TrustpilotReview {
  id: string;
  stars: { trustScore: number };
  title?: { text?: string };
  text?: string;
  consumer?: { displayName?: string };
  createdAt?: string;
  referenceId?: string;
}

async function ensureReputationReviewTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS reputation_review (
      id                TEXT PRIMARY KEY,
      platform          TEXT NOT NULL DEFAULT 'trustpilot',
      reviewer_name     TEXT,
      rating            INTEGER,
      title             TEXT,
      review_text       TEXT,
      published_at      TIMESTAMPTZ,
      responded_at      TIMESTAMPTZ,
      response_text     TEXT,
      status            TEXT NOT NULL DEFAULT 'pending',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function fetchTrustpilotReviews(
  businessUnitId: string,
  apiKey: string,
  apiSecret: string,
  page = 1,
  pageSize = 20,
): Promise<TrustpilotReview[]> {
  const creds = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  const params = new URLSearchParams({
    businessUnitId,
    perPage: String(pageSize),
    page: String(page),
    orderBy: 'createdat.desc',
    language: 'en',
  });

  const res = await fetch(
    `https://api.trustpilot.com/v1/business-units/${businessUnitId}/reviews?${params.toString()}`,
    {
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Trustpilot API error ${res.status}: ${await res.text().catch(() => '')}`);
  }

  const body = (await res.json().catch(() => ({}))) as { reviews?: TrustpilotReview[] };
  return body.reviews ?? [];
}

export async function run(): Promise<void> {
  const apiKey        = process.env['TRUSTPILOT_API_KEY'];
  const apiSecret     = process.env['TRUSTPILOT_API_SECRET'];
  const businessUnitId = process.env['TRUSTPILOT_BUSINESS_UNIT_ID'];

  if (!apiKey || !apiSecret || !businessUnitId) {
    return; // Honest no-op
  }

  await ensureReputationReviewTable();

  let inserted = 0;
  let urgentFlagged = 0;

  let reviews: TrustpilotReview[];
  try {
    reviews = await fetchTrustpilotReviews(businessUnitId, apiKey, apiSecret);
  } catch (err) {
    console.error('[trustpilot-review-sync] fetch failed:', err instanceof Error ? err.message : err);
    return;
  }

  for (const review of reviews) {
    const rating = review.stars?.trustScore ?? 0;
    const isUrgent = rating <= 2;
    const status = isUrgent ? 'urgent' : 'pending';

    const result = await db.query(
      `INSERT INTO reputation_review
         (id, platform, reviewer_name, rating, title, review_text, published_at, status, created_at, updated_at)
       VALUES ($1, 'trustpilot', $2, $3, $4, $5, $6, $7, now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [
        review.id,
        review.consumer?.displayName ?? 'Anonymous',
        rating,
        review.title?.text ?? null,
        review.text ?? null,
        review.createdAt ? new Date(review.createdAt) : null,
        status,
      ],
    );

    if ((result.rowCount ?? 0) > 0) {
      inserted++;
      if (isUrgent) urgentFlagged++;
    }
  }

  if (inserted > 0) {
    console.log(`[trustpilot-review-sync] inserted=${inserted} urgentFlagged=${urgentFlagged}`);
  }
}
