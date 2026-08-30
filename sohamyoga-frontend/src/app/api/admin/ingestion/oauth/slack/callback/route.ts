import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { handleSlackOAuthCallback } from '@/domain/ingestion/connectorCredentialOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const code = req.nextUrl.searchParams.get('code');
  const stateRaw = req.nextUrl.searchParams.get('state');
  const errorParam = req.nextUrl.searchParams.get('error');
  const redirectBase = `${req.nextUrl.origin}/admin/ai-ingestion/auth`;

  if (errorParam) return Response.redirect(`${redirectBase}?oauthError=${encodeURIComponent(errorParam)}`, 302);
  if (!code || !stateRaw) return Response.redirect(`${redirectBase}?oauthError=missing_code_or_state`, 302);

  let state: { tenantId?: string; connectorId?: string };
  try { state = JSON.parse(stateRaw); } catch { return Response.redirect(`${redirectBase}?oauthError=invalid_state`, 302); }
  if (!state.tenantId || !state.connectorId) return Response.redirect(`${redirectBase}?oauthError=invalid_state`, 302);

  const connectorResult = await query<{ connector_key: string }>(`SELECT connector_key FROM connector WHERE id = $1`, [state.connectorId]);
  if (!connectorResult.rows.length) return Response.redirect(`${redirectBase}?oauthError=connector_not_found`, 302);

  const redirectUri = `${req.nextUrl.origin}/api/admin/ingestion/oauth/slack/callback`;

  try {
    await handleSlackOAuthCallback(state.tenantId, state.connectorId, connectorResult.rows[0].connector_key, code, redirectUri, 'HUMAN', principal!.id);
    return Response.redirect(`${redirectBase}?oauthSuccess=1`, 302);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.redirect(`${redirectBase}?oauthError=${encodeURIComponent(message)}`, 302);
  }
}
