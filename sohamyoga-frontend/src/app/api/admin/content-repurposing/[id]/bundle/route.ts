export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: projects } = await client.query('SELECT * FROM repurpose_projects WHERE id=$1', [params.id]);
    if (!projects.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const project = projects[0] as { title: string };

    const { rows: assets } = await client.query(
      "SELECT id, platform FROM repurpose_assets WHERE project_id=$1 AND status='approved'",
      [params.id]
    );
    if (!assets.length) return Response.json({ error: 'No approved assets found. Approve assets before bundling.' }, { status: 400 });

    const assetIds = (assets as { id: number; platform: string }[]).map(a => a.id);
    const channels = [...new Set((assets as { id: number; platform: string }[]).map(a => a.platform))];

    const { rows } = await client.query(`
      INSERT INTO content_bundles (project_id, bundle_name, assets_count, channels, status)
      VALUES ($1, $2, $3, $4, 'ready') RETURNING *
    `, [params.id, `${project.title} Bundle`, assetIds.length, channels]);

    return Response.json({ bundle: rows[0], asset_ids: assetIds });
  } finally {
    client.release();
  }
}
