// Real Google Business Profile review sync. Uses the My Business Account
// Management API (accounts/locations) + the My Business Reviews API. Google
// has restructured these APIs across several product namespaces over the
// years -- the endpoints below are the current REST surface as of this
// writing (mybusinessaccountmanagement.googleapis.com,
// mybusinessreviews.googleapis.com). VERIFY against
// https://developers.google.com/my-business/reference/rest before relying on
// this in production -- Google's Business Profile APIs require a Google
// Cloud project with the relevant API enabled AND Google's manual approval
// (API access is gated, not self-serve), so this cannot be end-to-end tested
// without the user completing that approval process. Fails closed with the
// real HTTP error on any failure -- never fabricates review data.

export interface FetchedReview {
  googleReviewId: string;
  reviewerName: string;
  starRating: number | null;
  comment: string | null;
  createTime: string | null;
}

function starRatingToNumber(rating: string | undefined): number | null {
  const map: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return rating ? map[rating] ?? null : null;
}

export class GoogleBusinessApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'GoogleBusinessApiError';
  }
}

export async function listAccounts(accessToken: string): Promise<Array<{ name: string; accountName: string }>> {
  const res = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new GoogleBusinessApiError(`Failed to list Google Business accounts: ${res.status} ${await res.text()}`, res.status);
  const body = (await res.json()) as { accounts?: Array<{ name: string; accountName: string }> };
  return body.accounts ?? [];
}

export async function listLocations(accessToken: string, accountName: string): Promise<Array<{ name: string; title: string }>> {
  const res = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new GoogleBusinessApiError(`Failed to list locations: ${res.status} ${await res.text()}`, res.status);
  const body = (await res.json()) as { locations?: Array<{ name: string; title: string }> };
  return body.locations ?? [];
}

export async function fetchReviews(accessToken: string, locationName: string): Promise<FetchedReview[]> {
  const res = await fetch(`https://mybusiness.googleapis.com/v4/${locationName}/reviews`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new GoogleBusinessApiError(`Failed to fetch reviews: ${res.status} ${await res.text()}`, res.status);
  const body = (await res.json()) as {
    reviews?: Array<{ reviewId: string; reviewer?: { displayName?: string }; starRating?: string; comment?: string; createTime?: string }>;
  };
  return (body.reviews ?? []).map(r => ({
    googleReviewId: r.reviewId,
    reviewerName: r.reviewer?.displayName ?? 'Anonymous',
    starRating: starRatingToNumber(r.starRating),
    comment: r.comment ?? null,
    createTime: r.createTime ?? null,
  }));
}

export async function replyToReview(accessToken: string, locationName: string, reviewId: string, comment: string): Promise<void> {
  const res = await fetch(`https://mybusiness.googleapis.com/v4/${locationName}/reviews/${reviewId}/reply`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) throw new GoogleBusinessApiError(`Failed to post reply: ${res.status} ${await res.text()}`, res.status);
}
