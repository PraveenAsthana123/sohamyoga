import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { findScanner } from '@/domain/security/registry';
import { executeScan } from '@/domain/security/runScan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Triggers one real scan synchronously. SAST (semgrep, ~60s) and DAST (ZAP,
// up to a few minutes) are genuinely slow -- this route deliberately blocks
// until the tool exits rather than faking an instant response, so the
// caller's spinner reflects real work, not a queued job with no result yet.
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;

  const body = await req.json();
  const { category, tool, target } = body;
  if (!category || !tool || !target) {
    return Response.json({ error: 'category, tool, and target are required.' }, { status: 400 });
  }

  const scanner = findScanner(category, tool, target);
  if (!scanner) {
    return Response.json({ error: `No scanner registered for ${category}/${tool}/${target}.` }, { status: 404 });
  }

  const result = await executeScan(scanner, principal!.email ?? principal!.id);
  return Response.json(result, { status: result.status === 'completed' ? 200 : 502 });
}
