import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const [featureCount, versionRow, stackCount, vecCount, synCount] = await Promise.all([
      pool.query('SELECT COUNT(*) AS cnt FROM feature_registry').catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query("SELECT version_string FROM version_registry ORDER BY released_at DESC LIMIT 1").catch(() => ({ rows: [] })),
      pool.query('SELECT COUNT(*) AS cnt FROM tech_stack_entry').catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query('SELECT COUNT(*) AS cnt FROM vector_store').catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query('SELECT COUNT(*) AS cnt FROM synthetic_data_set').catch(() => ({ rows: [{ cnt: 0 }] })),
    ]);

    return NextResponse.json({
      feature_count: Number(featureCount.rows[0].cnt),
      current_version: versionRow.rows[0]?.version_string ?? '—',
      tech_stack_count: Number(stackCount.rows[0].cnt),
      vector_doc_count: Number(vecCount.rows[0].cnt),
      synthetic_dataset_count: Number(synCount.rows[0].cnt),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
