import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { getContact, updateContactDetails, updateContactStatus } from '@/domain/contact/repository';
import { ContactStatus } from '@/domain/contact/Contact';

const VALID_STATUSES: ContactStatus[] = ['new', 'contacted', 'qualified', 'customer', 'do_not_call', 'archived'];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const contact = await getContact(params.id);
  if (!contact) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
  return NextResponse.json(contact.toJSON());
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

  try {
    if (typeof body.status === 'string') {
      if (!VALID_STATUSES.includes(body.status as ContactStatus)) {
        return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
      }
      const updated = await updateContactStatus(params.id, body.status as ContactStatus);
      if (!updated) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
      return NextResponse.json(updated.toJSON());
    }

    const updated = await updateContactDetails(params.id, {
      fullName: typeof body.fullName === 'string' ? body.fullName.trim() : undefined,
      email: typeof body.email === 'string' ? body.email.trim() || null : undefined,
      phone: typeof body.phone === 'string' ? body.phone.trim() || null : undefined,
      clinicName: typeof body.clinicName === 'string' ? body.clinicName.trim() : undefined,
      preferredLanguage: typeof body.preferredLanguage === 'string' ? body.preferredLanguage : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    });
    if (!updated) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
    return NextResponse.json(updated.toJSON());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid update.' }, { status: 400 });
  }
}
