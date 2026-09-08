import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { addContactForCustomer, bulkImportContacts } from '@/domain/customer/repository';

// POST /api/admin/business-customers/:id/contacts -- admin adds a single
// contact on behalf of a business that doesn't want to self-serve. Same
// underlying data/ownership as the business's own self-service add.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
    const contact = await addContactForCustomer(params.id, {
      fullName,
      email: typeof body.email === 'string' ? body.email.trim() : undefined,
      phone: typeof body.phone === 'string' ? body.phone.trim() : undefined,
    });
    return NextResponse.json(contact, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not add contact.' }, { status: 400 });
  }
}

// PUT for bulk CSV import on a business's behalf (kept as a distinct verb
// from POST's single-contact add on the same route, mirroring the
// self-service import endpoint's row-level validation and reporting).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const body = await req.json().catch(() => null) as { contacts?: { fullName: string; email?: string; phone?: string }[] } | null;
  if (!body?.contacts || !Array.isArray(body.contacts)) {
    return NextResponse.json({ error: 'contacts (array of {fullName, email?, phone?}) is required.' }, { status: 400 });
  }

  try {
    const result = await bulkImportContacts(params.id, body.contacts);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Import failed.' }, { status: 500 });
  }
}
