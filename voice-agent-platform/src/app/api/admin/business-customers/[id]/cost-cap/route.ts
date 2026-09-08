import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { setMonthlyCostCap, getMonthlyCostCap, monthToDateCostForCustomer } from '@/domain/customer/repository';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;
  const [cap, spent] = await Promise.all([getMonthlyCostCap(params.id), monthToDateCostForCustomer(params.id)]);
  return NextResponse.json({ monthlyCostCapUsd: cap, monthToDateSpendUsd: spent });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const cap = typeof body.monthlyCostCapUsd === 'number' ? body.monthlyCostCapUsd : null;
  if (cap !== null && cap < 0) return NextResponse.json({ error: 'Cap cannot be negative.' }, { status: 400 });

  await setMonthlyCostCap(params.id, cap);
  return NextResponse.json({ ok: true, monthlyCostCapUsd: cap });
}
