import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  const { id } = params;
  await query(
    `UPDATE platform_scenario_run
     SET status='completed', approved_by=$1, approved_at=NOW()
     WHERE id=$2 AND status='pending_approval'`,
    [principal?.email ?? 'admin', id]
  );
  return Response.json({ success: true, run_id: id, status: 'completed' });
}
