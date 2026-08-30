import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { getForm, setFormStatus } from '@/domain/form/repository';
import { FormStatus } from '@/domain/form/FormDefinition';

const VALID_STATUSES: FormStatus[] = ['draft', 'active', 'archived'];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const form = await getForm(params.id);
  if (!form) return NextResponse.json({ error: 'Form not found.' }, { status: 404 });
  return NextResponse.json(form.toJSON());
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  if (typeof body.status !== 'string' || !VALID_STATUSES.includes(body.status as FormStatus)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const updated = await setFormStatus(params.id, body.status as FormStatus);
  if (!updated) return NextResponse.json({ error: 'Form not found.' }, { status: 404 });
  return NextResponse.json(updated.toJSON());
}
