import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { allScanners } from '@/domain/security/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real, fixed list of runnable scans -- category/tool/target combos that
// map 1:1 to an actual CLI invocation in src/domain/security/scanners/*.ts.
// No category is listed here without a real tool wired up (DAST's ZAP
// baseline included, since the docker image is pulled and verified working).
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;

  const scanners = allScanners().map(s => ({ category: s.category, tool: s.tool, target: s.target }));
  return Response.json({ scanners });
}
