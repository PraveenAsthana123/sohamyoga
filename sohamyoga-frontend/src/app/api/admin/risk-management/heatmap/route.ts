export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(`
      SELECT likelihood, impact, risk_score, COUNT(*) as count,
             json_agg(json_build_object('id',id,'title',title,'category',category,'status',status)) as risks
      FROM risk_register
      GROUP BY likelihood, impact, risk_score
      ORDER BY likelihood, impact
    `);
    // Build 5x5 matrix
    const matrix: { likelihood: number; impact: number; score: number; count: number; risks: unknown[] }[][] = [];
    for (let lh = 1; lh <= 5; lh++) {
      matrix[lh] = [];
      for (let imp = 1; imp <= 5; imp++) {
        const cell = r.rows.find(row => Number(row.likelihood) === lh && Number(row.impact) === imp);
        matrix[lh][imp] = {
          likelihood: lh,
          impact: imp,
          score: lh * imp,
          count: cell ? Number(cell.count) : 0,
          risks: cell ? cell.risks : [],
        };
      }
    }
    const summary = {
      critical: r.rows.filter(row => Number(row.risk_score) >= 20).reduce((s, row) => s + Number(row.count), 0),
      high: r.rows.filter(row => Number(row.risk_score) >= 12 && Number(row.risk_score) < 20).reduce((s, row) => s + Number(row.count), 0),
      medium: r.rows.filter(row => Number(row.risk_score) >= 6 && Number(row.risk_score) < 12).reduce((s, row) => s + Number(row.count), 0),
      low: r.rows.filter(row => Number(row.risk_score) < 6).reduce((s, row) => s + Number(row.count), 0),
    };
    return Response.json({ matrix: matrix.slice(1).map(row => row.slice(1)), summary });
  } finally { client.release(); }
}
