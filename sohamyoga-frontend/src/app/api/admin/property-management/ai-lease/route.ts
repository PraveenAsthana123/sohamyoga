import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { tenant_name, address, amount, lease_start, lease_end, late_fee = 75, unit_number = '' } = body;
    if (!tenant_name || !address || !amount || !lease_start || !lease_end) {
      return Response.json({ error: 'tenant_name, address, amount, lease_start, lease_end required' }, { status: 400 });
    }
    const unitStr = unit_number ? `, Unit ${unit_number}` : '';
    const prompt = `Draft a standard residential lease agreement for Alberta, Canada. Tenant: ${tenant_name}, Property: ${address}${unitStr}, Rent: $${amount}/month, Term: ${lease_start} to ${lease_end}. Include: Residential Tenancies Act Alberta references, pet policy (no pets without written consent), late payment clause ($${late_fee} after 3 days), utilities responsibility (tenant pays utilities), maintenance obligations (tenant keeps clean, landlord maintains structure), notice requirements (3 months for landlord, 60 days for tenant), smoking policy (no smoking on premises). Format as a professional lease agreement with numbered sections.`;
    let leaseText = '';
    let aiUsed = false;
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json();
        leaseText = data.response || '';
        aiUsed = true;
      }
    } catch { /* Ollama unavailable — use fallback */ }
    if (!leaseText) {
      leaseText = `RESIDENTIAL LEASE AGREEMENT — Alberta, Canada

This Residential Tenancy Agreement is entered into pursuant to the Residential Tenancies Act, RSA 2000, c R-17.1.

PARTIES
Landlord: [Landlord Name]
Tenant: ${tenant_name}

PROPERTY
Address: ${address}${unitStr}

TERM
Lease Start: ${lease_start}
Lease End: ${lease_end}

RENT
Monthly Rent: $${amount} CAD, due on the 1st of each month.
Late Payment: A late fee of $${late_fee} will be assessed after 3 days.

PET POLICY
No pets are permitted without prior written consent from the Landlord.

UTILITIES
Tenant is responsible for all utilities unless otherwise agreed in writing.

MAINTENANCE
Tenant shall maintain the premises in a clean and orderly condition.
Landlord shall maintain the structure, roof, and major systems.

NOTICE
Tenant must provide 60 days written notice to vacate.
Landlord must provide 3 months written notice to terminate tenancy.

SMOKING POLICY
Smoking is strictly prohibited on the premises.

SIGNATURES
Landlord: ___________________ Date: ___________
Tenant: ${tenant_name} ___________________ Date: ___________

NOTE: This is a template generated for review. Consult a legal professional before execution.`;
    }
    return Response.json({ lease: leaseText, ai_used: aiUsed });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
