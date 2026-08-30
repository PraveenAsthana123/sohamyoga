import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { createForm, listForms } from '@/domain/form/repository';
import { FormField, FormFieldType } from '@/domain/form/FormDefinition';

const VALID_TYPES: FormFieldType[] = ['text', 'email', 'phone', 'textarea', 'select'];

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const forms = await listForms();
  return NextResponse.json(forms.map((f) => f.toJSON()));
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
  const rawFields = Array.isArray(body.fields) ? (body.fields as unknown[]) : [];

  if (!slug || !name) return NextResponse.json({ error: 'slug and name are required.' }, { status: 400 });

  const fields: FormField[] = [];
  for (const raw of rawFields) {
    if (typeof raw !== 'object' || raw === null) continue;
    const f = raw as Record<string, unknown>;
    if (typeof f.key !== 'string' || typeof f.label !== 'string') continue;
    const type = VALID_TYPES.includes(f.type as FormFieldType) ? (f.type as FormFieldType) : 'text';
    fields.push({
      key: f.key,
      label: f.label,
      type,
      required: Boolean(f.required),
      options: Array.isArray(f.options) ? (f.options as string[]) : undefined,
    });
  }

  try {
    const form = await createForm({
      slug,
      name,
      description: typeof body.description === 'string' ? body.description : null,
      fields,
      successMessage: typeof body.successMessage === 'string' ? body.successMessage : undefined,
    });
    return NextResponse.json(form.toJSON(), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid form.' }, { status: 400 });
  }
}
