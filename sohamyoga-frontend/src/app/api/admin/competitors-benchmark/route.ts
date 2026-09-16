import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_DIMENSIONS = [
  'discoverability', 'website_quality', 'seo', 'local_presence',
  'reputation', 'social_presence', 'content_quality', 'pricing_competitiveness',
];

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const [competitors, scores] = await Promise.all([
      client.query<{ id: string; name: string; website: string | null; notes: string; created_at: string }>(
        `SELECT id, name, website, notes, created_at FROM competitor ORDER BY name ASC`,
      ),
      client.query<{
        id: string;
        competitor_id: string;
        competitor_name: string;
        dimension: string;
        score: number;
        observed_at: string;
        notes: string;
        created_at: string;
      }>(
        `SELECT cbs.id, cbs.competitor_id, c.name AS competitor_name,
                cbs.dimension, cbs.score, cbs.observed_at, cbs.notes, cbs.created_at
         FROM competitor_benchmark_score cbs
         JOIN competitor c ON c.id = cbs.competitor_id
         ORDER BY cbs.observed_at DESC, c.name, cbs.dimension`,
      ),
    ]);

    // Summary stats per competitor: avg score, top/bottom
    const statsMap: Record<string, { name: string; scores: number[]; dimensions: Record<string, number> }> = {};
    scores.rows.forEach((s) => {
      if (!statsMap[s.competitor_id]) {
        statsMap[s.competitor_id] = { name: s.competitor_name, scores: [], dimensions: {} };
      }
      statsMap[s.competitor_id].scores.push(s.score);
      statsMap[s.competitor_id].dimensions[s.dimension] = s.score;
    });

    const summaryRows = Object.entries(statsMap).map(([id, data]) => ({
      competitor_id: id,
      competitor_name: data.name,
      avg_score: data.scores.length
        ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
        : null,
      score_count: data.scores.length,
      dimensions: data.dimensions,
    }));

    const allScores = scores.rows.map((s) => s.score);
    const overallAvg = allScores.length
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : null;

    return Response.json({
      competitors: competitors.rows,
      scores: scores.rows,
      summary: summaryRows,
      dimensions: VALID_DIMENSIONS,
      stats: {
        totalCompetitors: competitors.rows.length,
        totalScores: scores.rows.length,
        overallAvgScore: overallAvg,
      },
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as {
    competitor_id?: string;
    dimension?: string;
    score?: number;
    observed_at?: string;
    notes?: string;
  } | null;

  if (!body?.competitor_id || !body?.dimension || body?.score === undefined) {
    return Response.json({ error: 'competitor_id, dimension, and score are required.' }, { status: 400 });
  }
  if (!VALID_DIMENSIONS.includes(body.dimension)) {
    return Response.json({ error: `dimension must be one of ${VALID_DIMENSIONS.join('|')}` }, { status: 400 });
  }
  if (typeof body.score !== 'number' || body.score < 0 || body.score > 100) {
    return Response.json({ error: 'score must be a number 0-100.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO competitor_benchmark_score (competitor_id, dimension, score, observed_at, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, 'admin')
       ON CONFLICT (competitor_id, dimension, observed_at)
       DO UPDATE SET score = EXCLUDED.score, notes = EXCLUDED.notes
       RETURNING *`,
      [
        body.competitor_id,
        body.dimension,
        Math.round(body.score),
        body.observed_at ?? new Date().toISOString().slice(0, 10),
        body.notes ?? '',
      ],
    );
    return Response.json({ score: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
