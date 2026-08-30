import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { getAdminPrincipal, requireAdmin } from '@/lib/admin-auth';
import { getCredentialStatus, saveClientCredentials } from '@/domain/ingestion/connectorCredentialOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — status only. Never returns secret values or vault:// reference strings.
export async function GET(req: NextRequest, { params }: { params: { connectorId: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = req.nextUrl.searchParams.get('tenantId');
  if (!tenantId) return Response.json({ error: 'tenantId is required.' }, { status: 400 });

  const status = await getCredentialStatus(tenantId, params.connectorId);
  return Response.json(status);
}

// POST — save a Client ID + Client Secret for this connector (write-only; never echoed back).
export async function POST(req: NextRequest, { params }: { params: { connectorId: string } }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { tenantId?: string; connectorKey?: string; clientId?: string; clientSecret?: string } | null;
  if (!body?.tenantId || !body.connectorKey || !body.clientId?.trim() || !body.clientSecret?.trim()) {
    return Response.json({ error: 'tenantId, connectorKey, clientId, and clientSecret are all required.' }, { status: 400 });
  }

  try {
    await saveClientCredentials(
      body.tenantId, params.connectorId, body.connectorKey,
      body.clientId.trim(), body.clientSecret.trim(), 'HUMAN', principal!.id,
    );
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 502 });
  }
}
