import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const result = await pool.query(
      'SELECT * FROM quality_benchmark ORDER BY module_name, dimension LIMIT 500'
    );
    return Response.json({ benchmarks: result.rows });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { module_name, dimension, score, evidence, benchmark_method } = body;
    const result = await pool.query(
      `INSERT INTO quality_benchmark (module_name, dimension, score, evidence, benchmark_method)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (module_name, dimension) DO UPDATE SET score=$3, evidence=$4, assessed_at=NOW()
       RETURNING *`,
      [module_name, dimension, score, evidence ?? '', benchmark_method ?? 'manual']
    );
    return Response.json({ benchmark: result.rows[0] }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
