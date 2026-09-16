import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  const { reason } = await req.json() as { reason?: string };
  await query(
    `UPDATE platform_scenario_run
     SET status='failed', error_message=$1, approved_by=$2, approved_at=NOW()
     WHERE id=$3 AND status='pending_approval'`,
    [reason ?? 'Rejected by admin', principal?.email ?? 'admin', params.id]
  );
  return Response.json({ success: true, run_id: params.id, status: 'failed' });
}
