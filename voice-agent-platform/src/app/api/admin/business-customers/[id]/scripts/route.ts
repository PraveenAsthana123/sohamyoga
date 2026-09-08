import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { addScriptForCustomer, getBusinessCustomer, listScriptsForCustomer } from '@/domain/customer/repository';

// GET/POST /api/admin/business-customers/:id/scripts -- admin views/creates
// content-level scripts on behalf of a business that doesn't want to
// self-serve. Same content-only scope as the business's own Scripts tab --
// Vapi technical config and sync remain on the separate, existing
// /admin/scripts + sync-vapi routes.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;
  const scripts = await listScriptsForCustomer(params.id);
  return NextResponse.json({ scripts });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const customer = await getBusinessCustomer(params.id);
  if (!customer) return NextResponse.json({ error: 'Business customer not found.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const direction = body.direction === 'inbound' ? 'inbound' : body.direction === 'outbound' ? 'outbound' : null;
  const opening = typeof body.opening === 'string' ? body.opening.trim() : '';
  const closing = typeof body.closing === 'string' ? body.closing.trim() : '';
  if (!name || !direction || !opening || !closing) {
    return NextResponse.json({ error: 'name, direction (inbound|outbound), opening, and closing are required.' }, { status: 400 });
  }

  try {
    const id = await addScriptForCustomer(params.id, customer.serviceType, {
      name, direction, opening, closing,
      scenarioKey: typeof body.scenarioKey === 'string' ? body.scenarioKey : undefined,
      objectionHandling: typeof body.objectionHandling === 'string' ? body.objectionHandling : '',
      discoveryQuestions: Array.isArray(body.discoveryQuestions) ? body.discoveryQuestions.filter((q): q is string => typeof q === 'string') : [],
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not create script.' }, { status: 400 });
  }
}
