import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT * FROM quality_benchmark ORDER BY module_name, dimension'
    );
    return NextResponse.json({ benchmarks: result.rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ benchmark: result.rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
