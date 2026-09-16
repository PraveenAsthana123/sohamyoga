export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM data_collection_jobs WHERE id=$1', [id]);
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });

    // Simulate data collection run
    const newRecords = Math.floor(Math.random() * 500) + 50;
    const preview = {
      sample_records: [
        { timestamp: new Date().toISOString(), value: 'Sample data point 1', source: rows[0].source_url },
        { timestamp: new Date().toISOString(), value: 'Sample data point 2', source: rows[0].source_url },
        { timestamp: new Date().toISOString(), value: 'Sample data point 3', source: rows[0].source_url },
      ],
      total_this_run: newRecords,
    };

    await client.query(
      `UPDATE data_collection_jobs SET last_run=NOW(), records_collected=records_collected+$1, status='idle', data_preview=$2 WHERE id=$3`,
      [newRecords, JSON.stringify(preview), id]
    );

    const { rows: updated } = await client.query('SELECT * FROM data_collection_jobs WHERE id=$1', [id]);
    return Response.json({ job: updated[0], new_records: newRecords, preview });
  } finally { client.release(); }
}
