import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/requireCustomer';
import { addContactForCustomer, listContactsForCustomer } from '@/domain/customer/repository';

// GET/POST /api/customer/contacts -- scoped strictly to the authenticated
// business customer's own contacts (owner_customer_id), never another
// business's list.
export async function GET(req: NextRequest) {
  const auth = await requireCustomer(req);
  if (auth.denied) return auth.denied;
  const contacts = await listContactsForCustomer(auth.principal.id);
  return NextResponse.json({ contacts });
}

export async function POST(req: NextRequest) {
  const auth = await requireCustomer(req);
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
    const contact = await addContactForCustomer(auth.principal.id, {
      fullName,
      email: typeof body.email === 'string' ? body.email.trim() : undefined,
      phone: typeof body.phone === 'string' ? body.phone.trim() : undefined,
    });
    return NextResponse.json(contact, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not add contact.' }, { status: 400 });
  }
}
