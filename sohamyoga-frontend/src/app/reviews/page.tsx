// Real public on-site reviews page — Review, Rating & Reputation Management.
// Distinct from Google Business reviews (external, synced separately). Shows
// only real, published service_review rows tied to real checked-in bookings,
// with a real aggregate star rating computed from those rows — never a
// fabricated average.
import { databaseConfigured, query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

interface ReviewRow {
  reviewer_name: string; star_rating: number; comment: string; staff_response: string | null;
  created_at: Date; class_name: string; teacher_name: string;
}

async function getReviews(): Promise<ReviewRow[]> {
  if (!databaseConfigured()) return [];
  const result = await query<ReviewRow>(
    `SELECT sr.reviewer_name, sr.star_rating, sr.comment, sr.staff_response, sr.created_at,
            cs.class_name, cs.teacher_name
     FROM service_review sr
     JOIN booking b ON b.id = sr.booking_id
     JOIN class_session cs ON cs.id = b.class_session_id
     WHERE sr.status = 'published'
     ORDER BY sr.created_at DESC`,
  );
  return result.rows;
}

function Stars({ n }: { n: number }) {
  return <span className="text-amber-500" aria-label={`${n} out of 5 stars`}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>;
}

export default async function ReviewsPage() {
  const reviews = await getReviews();
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.star_rating, 0) / reviews.length : 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900">Student Reviews</h1>
        {reviews.length > 0 ? (
          <p className="mt-2 text-lg text-gray-700"><Stars n={Math.round(avg)} /> <span className="text-gray-500 text-sm">{avg.toFixed(1)} out of 5 · {reviews.length} review{reviews.length === 1 ? '' : 's'}</span></p>
        ) : (
          <p className="mt-2 text-sm text-gray-400">No reviews published yet.</p>
        )}

        <div className="mt-10 space-y-6">
          {reviews.map((r, i) => (
            <div key={i} className="border-b pb-6">
              <div className="flex justify-between items-baseline">
                <p className="font-medium text-gray-800">{r.reviewer_name}</p>
                <Stars n={r.star_rating} />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{r.class_name} with {r.teacher_name}</p>
              {r.comment && <p className="mt-2 text-gray-700">{r.comment}</p>}
              {r.staff_response && (
                <p className="mt-2 text-sm text-gray-500 bg-gray-50 rounded p-3">
                  <span className="font-medium text-gray-700">Studio response: </span>{r.staff_response}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
