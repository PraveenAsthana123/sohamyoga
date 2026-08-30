import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../lib/session-auth';
import { query } from '../../../lib/postgres';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const competitors = await query(`SELECT * FROM competitor ORDER BY name`);
  const features = await query(`SELECT * FROM competitor_feature ORDER BY sort_order, feature_key`);
  const columns = await query<{ feature_key: string }>(`SELECT DISTINCT feature_key FROM competitor_feature ORDER BY feature_key`);

  return Response.json({
    competitors: competitors.rows,
    features: features.rows,
    featureColumns: columns.rows.map(r => r.feature_key),
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: { name?: string; website?: string; notes?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body.name) return Response.json({ error: 'name is required.' }, { status: 400 });

  const result = await query(
    `INSERT INTO competitor (name, website, notes, source) VALUES ($1, $2, $3, $4) RETURNING *`,
    [body.name, body.website ?? null, body.notes ?? null, body.source ?? 'manual entry'],
  );
  return Response.json({ competitor: result.rows[0] }, { status: 201 });
}
