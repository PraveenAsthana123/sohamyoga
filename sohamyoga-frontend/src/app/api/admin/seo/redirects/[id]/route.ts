import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { deleteRedirectRule } from '@/domain/seo/redirectRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const tenantId = await getPrimaryTenantId();
  const deleted = await deleteRedirectRule(tenantId, params.id);
  if (!deleted) return Response.json({ error: 'Redirect rule not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
