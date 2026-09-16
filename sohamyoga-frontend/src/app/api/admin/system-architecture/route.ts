import { NextRequest} from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const [featureCount, versionRow, stackCount, vecCount, synCount] = await Promise.all([
      pool.query('SELECT COUNT(*) AS cnt FROM feature_registry').catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query("SELECT version_string FROM version_registry ORDER BY released_at DESC LIMIT 1").catch(() => ({ rows: [] })),
      pool.query('SELECT COUNT(*) AS cnt FROM tech_stack_entry').catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query('SELECT COUNT(*) AS cnt FROM vector_store').catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query('SELECT COUNT(*) AS cnt FROM synthetic_data_set').catch(() => ({ rows: [{ cnt: 0 }] })),
    ]);

    return Response.json({
      feature_count: Number(featureCount.rows[0].cnt),
      current_version: versionRow.rows[0]?.version_string ?? '—',
      tech_stack_count: Number(stackCount.rows[0].cnt),
      vector_doc_count: Number(vecCount.rows[0].cnt),
      synthetic_dataset_count: Number(synCount.rows[0].cnt),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
