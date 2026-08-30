import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { createScript, listScripts } from '@/domain/script/repository';
import { ClinicServiceType } from '@/domain/script/CallScript';

const VALID_SERVICE_TYPES: ClinicServiceType[] = ['dental', 'chiropractic', 'physiotherapy', 'ent', 'massage_therapy'];

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const scripts = await listScripts();
  return NextResponse.json(scripts.map((s) => s.toJSON()));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const serviceType = body.serviceType as ClinicServiceType;
  if (!slug || !name) return NextResponse.json({ error: 'slug and name are required.' }, { status: 400 });
  if (!VALID_SERVICE_TYPES.includes(serviceType)) {
    return NextResponse.json({ error: `serviceType must be one of: ${VALID_SERVICE_TYPES.join(', ')}` }, { status: 400 });
  }

  const sections = (body.sections ?? {}) as Record<string, unknown>;
  const opening = typeof sections.opening === 'string' ? sections.opening : '';
  const closing = typeof sections.closing === 'string' ? sections.closing : '';
  const objectionHandling = typeof sections.objectionHandling === 'string' ? sections.objectionHandling : '';
  const discoveryQuestions = Array.isArray(sections.discoveryQuestions)
    ? (sections.discoveryQuestions as unknown[]).filter((q): q is string => typeof q === 'string')
    : [];

  try {
    const { script, version } = await createScript({
      slug,
      name,
      serviceType,
      sections: { opening, closing, objectionHandling, discoveryQuestions },
      createdBy: auth.principal.email,
    });
    return NextResponse.json({ script: script.toJSON(), version: version.toJSON() }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid script.' }, { status: 400 });
  }
}
