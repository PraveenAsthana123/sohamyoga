import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Version Management read path -- see the snapshot write in
// src/app/api/brand-kits/[id]/route.ts PATCH.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{ version: number; snapshot: Record<string, unknown>; changed_action: string; changed_by: string; created_at: string }>(
    `SELECT version, snapshot, changed_action, changed_by, created_at
     FROM brand_kit_history WHERE brand_kit_id = $1 ORDER BY version DESC LIMIT 50`,
    [params.id],
  );
  return Response.json({
    history: rows.rows.map(r => ({
      version: r.version, snapshot: r.snapshot, changedAction: r.changed_action,
      changedBy: r.changed_by, createdAt: r.created_at,
    })),
  });
}
