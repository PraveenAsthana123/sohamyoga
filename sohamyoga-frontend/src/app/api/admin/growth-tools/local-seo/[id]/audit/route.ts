import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

async function ollamaChat(prompt: string): Promise<string> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return '';
    const data = await res.json() as { response?: string };
    return data.response?.trim() || '';
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();

  const { rows: locs } = await pool.query(`SELECT * FROM local_seo_locations WHERE id=$1`, [params.id]);
  if (!locs.length) return Response.json({ error: 'Location not found' }, { status: 404 });
  const loc = locs[0] as {
    id: string; business_name: string; city: string; primary_category: string;
    nap_consistent: boolean; phone: string; address: string;
  };

  const { rows: cits } = await pool.query(
    `SELECT * FROM local_seo_citations WHERE location_id=$1`,
    [params.id],
  );

  const TOTAL_DIRS = 11;
  const listed = cits.filter((c: { status: string }) => c.status === 'listed').length;
  const citationScore = Math.round((listed / TOTAL_DIRS) * 100);

  const napIssues: string[] = [];
  cits.forEach((c: { status: string; nap_correct: boolean; directory_name: string }) => {
    if (c.status === 'listed' && c.nap_correct === false) {
      napIssues.push(`${c.directory_name}: NAP mismatch detected`);
    }
  });
  if (!loc.nap_consistent) napIssues.push('Location marked as NAP inconsistent');

  const directoriesMissing = [
    'Google Business Profile', 'Yelp', 'Bing Places', 'Apple Maps', 'Facebook',
    'Yellow Pages Canada', 'Foursquare', 'Better Business Bureau',
    'Houzz', 'Healthgrades', 'TripAdvisor',
  ].filter((d) => {
    const c = cits.find((ci: { directory_name: string }) => ci.directory_name === d);
    return !c || c.status === 'not_listed';
  });

  // Update citation_score and last_audit_at
  await pool.query(
    `UPDATE local_seo_locations SET citation_score=$1, last_audit_at=NOW() WHERE id=$2`,
    [citationScore, params.id],
  );

  const prompt = `Suggest 5 local SEO improvements for a ${loc.primary_category || 'yoga'} business in ${loc.city || 'Toronto'}. Focus on: Google Business Profile, local citations, review generation, local content. Be specific and actionable. Format as a numbered list.`;
  const aiText = await ollamaChat(prompt);
  const aiRecommendations = aiText
    ? aiText.split('\n').filter((l: string) => l.trim()).slice(0, 10)
    : [
        '1. Complete all Google Business Profile fields including Q&A, products, and services.',
        '2. Request reviews from recent customers via email follow-up within 48 hours.',
        '3. Add location-specific keywords to page titles and meta descriptions.',
        '4. Publish a weekly Google Post to signal freshness to the algorithm.',
        '5. Build citations on Yellow Pages Canada, Foursquare, and BBB to raise citation score.',
      ];

  return Response.json({ citationScore, napIssues, aiRecommendations, directoriesMissing, auditedAt: new Date().toISOString() });
}
