import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { createDraftVersion } from '@/domain/script/repository';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const sections = (body.sections ?? {}) as Record<string, unknown>;
  const opening = typeof sections.opening === 'string' ? sections.opening : '';
  const closing = typeof sections.closing === 'string' ? sections.closing : '';
  const objectionHandling = typeof sections.objectionHandling === 'string' ? sections.objectionHandling : '';
  const discoveryQuestions = Array.isArray(sections.discoveryQuestions)
    ? (sections.discoveryQuestions as unknown[]).filter((q): q is string => typeof q === 'string')
    : [];

  try {
    const version = await createDraftVersion(
      params.id,
      { opening, closing, objectionHandling, discoveryQuestions },
      auth.principal.email
    );
    return NextResponse.json(version.toJSON(), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid version.' }, { status: 400 });
  }
}
