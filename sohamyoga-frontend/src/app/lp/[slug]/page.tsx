// Real public landing-page renderer — Module 7. Server component: fetches the
// published page by slug directly, increments a real view_count on every hit,
// renders its linked CTA (from the CTA registry's real /go/[slug] redirect).
import { notFound } from 'next/navigation';
import { databaseConfigured, query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

interface PageRow {
  title: string; headline: string; subheadline: string | null; body_markdown: string;
  seo_title: string | null; seo_description: string | null; status: string;
  cta_label: string | null; cta_slug: string | null;
}

async function getPage(slug: string): Promise<PageRow | null> {
  if (!databaseConfigured()) return null;
  const result = await query<PageRow>(
    `SELECT lp.title, lp.headline, lp.subheadline, lp.body_markdown, lp.seo_title, lp.seo_description, lp.status::text,
            c.label AS cta_label, c.tracking_slug AS cta_slug
     FROM landing_page lp LEFT JOIN cta c ON c.id = lp.cta_id
     WHERE lp.slug = $1`,
    [slug],
  );
  if (!result.rows.length || result.rows[0].status !== 'published') return null;
  await query(`UPDATE landing_page SET view_count = view_count + 1 WHERE slug = $1`, [slug]);
  return result.rows[0];
}

export default async function LandingPage({ params }: { params: { slug: string } }) {
  const page = await getPage(params.slug);
  if (!page || page.status !== 'published') notFound();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl font-bold text-gray-900">{page.headline}</h1>
        {page.subheadline && <p className="mt-4 text-lg text-gray-600">{page.subheadline}</p>}
        {page.body_markdown && <div className="mt-8 text-left whitespace-pre-wrap text-gray-700">{page.body_markdown}</div>}
        {page.cta_label && page.cta_slug && (
          <a href={`/go/${page.cta_slug}`} className="mt-8 inline-block rounded-lg bg-indigo-600 px-6 py-3 text-white font-semibold hover:bg-indigo-700">
            {page.cta_label}
          </a>
        )}
      </div>
    </div>
  );
}
