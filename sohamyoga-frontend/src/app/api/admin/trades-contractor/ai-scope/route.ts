import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { trade_type, client_description } = await req.json();
    if (!trade_type || !client_description) return Response.json({ error: 'trade_type and client_description required' }, { status: 400 });

    const prompt = `You are a professional Canadian trades contractor. A client has described their project as follows:
"${client_description}"

Write a professional, formal Scope of Work document for a ${trade_type} project in Alberta, Canada. The scope should:
- Start with a clear Project Overview
- List all Inclusions (what IS included in the quote)
- List all Exclusions (what is NOT included — important to prevent scope creep)
- Note Permit and Inspection requirements
- Include Materials Specification section (grade/quality level)
- Include an Acceptance clause
- Use professional contractor language
- Be suitable for a signed service agreement

Format clearly with numbered sections. Keep it concise but complete (400-600 words).`;

    let scope = '';
    try {
      const r = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (r.ok) { const d = await r.json() as { response?: string }; scope = d.response || ''; }
    } catch { /* graceful fallback */ }

    if (!scope) {
      scope = `SCOPE OF WORK — ${trade_type.toUpperCase()} SERVICES

1. PROJECT OVERVIEW
This Scope of Work describes the ${trade_type} services to be performed as described by the client. All work will be completed in accordance with the Alberta Building Code (2019) and applicable Canadian Standards.

2. INCLUSIONS
The following work is included in this quotation:
- All labour required to complete the described ${trade_type} scope
- Standard materials as specified in the Materials section
- Cleanup and disposal of job-related debris
- Coordination of required inspections

3. EXCLUSIONS
The following items are NOT included unless separately quoted:
- Work beyond the described scope
- Repair of pre-existing damage discovered during work
- Drywall patching/painting after rough-in (unless specified)
- Permit fees (charged at cost + 10% handling)
- Asbestos or hazardous material remediation
- Structural modifications not described above

4. PERMIT & INSPECTION REQUIREMENTS
Contractor will apply for all required City of Calgary Development & Building Approvals permits. Client is responsible for providing access for Safety Codes Officer inspections during scheduled inspection windows.

5. MATERIALS SPECIFICATION
Unless otherwise specified, standard-grade contractor-supply materials will be used. Premium material upgrades are available at additional cost. All materials meet or exceed Alberta Safety Codes standards.

6. ACCEPTANCE
This scope of work is valid for 30 days from the date of issue. Acceptance occurs upon signed agreement and deposit payment. Work will be scheduled upon receipt of deposit and permit approval.

All work is warranted for 12 months against defects in workmanship.`;
    }

    return Response.json({ scope, trade_type });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
