import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { handleOAuthCallback } from '@/domain/reputation/reputationCredentialOps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const code = req.nextUrl.searchParams.get('code');
  const stateRaw = req.nextUrl.searchParams.get('state');
  const errorParam = req.nextUrl.searchParams.get('error');
  const redirectBase = `${req.nextUrl.origin}/admin/reputation`;

  if (errorParam) return Response.redirect(`${redirectBase}?oauthError=${encodeURIComponent(errorParam)}`, 302);
  if (!code || !stateRaw) return Response.redirect(`${redirectBase}?oauthError=missing_code_or_state`, 302);

  let state: { tenantId?: string };
  try { state = JSON.parse(stateRaw); } catch { return Response.redirect(`${redirectBase}?oauthError=invalid_state`, 302); }
  if (!state.tenantId) return Response.redirect(`${redirectBase}?oauthError=invalid_state`, 302);

  const redirectUri = `${req.nextUrl.origin}/api/admin/reputation/oauth/callback`;

  try {
    await handleOAuthCallback(state.tenantId, code, redirectUri);
    return Response.redirect(`${redirectBase}?oauthSuccess=1`, 302);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.redirect(`${redirectBase}?oauthError=${encodeURIComponent(message)}`, 302);
  }
}
