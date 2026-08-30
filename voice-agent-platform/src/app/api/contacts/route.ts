import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { createContact, listContacts } from '@/domain/contact/repository';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const contacts = await listContacts();
  return NextResponse.json(contacts.map((c) => c.toJSON()));
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

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  if (!fullName) return NextResponse.json({ error: 'fullName is required.' }, { status: 400 });

  try {
    const contact = await createContact({
      fullName,
      email: typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null,
      phone: typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null,
      clinicName: typeof body.clinicName === 'string' ? body.clinicName.trim() : null,
      preferredLanguage: typeof body.preferredLanguage === 'string' ? body.preferredLanguage : 'en',
      source: 'manual',
      notes: typeof body.notes === 'string' ? body.notes : null,
    });
    return NextResponse.json(contact.toJSON(), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid contact.' }, { status: 400 });
  }
}
