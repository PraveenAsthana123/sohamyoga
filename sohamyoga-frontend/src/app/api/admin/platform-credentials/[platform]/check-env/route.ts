// GET /api/admin/platform-credentials/[platform]/check-env?var=VARNAME
// Returns { set: boolean } — NEVER reveals the value
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ platform: string }> };

export async function GET(req: NextRequest, { params: _params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const varName = req.nextUrl.searchParams.get('var');

  if (!varName) {
    return NextResponse.json({ error: 'Missing var parameter' }, { status: 400 });
  }

  // Validate: only allow known env var patterns (uppercase + underscore)
  if (!/^[A-Z][A-Z0-9_]{1,60}$/.test(varName)) {
    return NextResponse.json({ error: 'Invalid variable name format' }, { status: 400 });
  }

  const value = process.env[varName];
  const isSet = Boolean(value && value.trim().length > 0);

  return NextResponse.json({ set: isSet });
}
