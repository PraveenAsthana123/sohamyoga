import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { getScript, listVersions } from '@/domain/script/repository';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const script = await getScript(params.id);
  if (!script) return NextResponse.json({ error: 'Script not found.' }, { status: 404 });
  const versions = await listVersions(params.id);
  return NextResponse.json({ script: script.toJSON(), versions: versions.map((v) => v.toJSON()) });
}
