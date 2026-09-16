import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { project_name, project_type, contract_value, client_type } = await req.json();
    const prompt = `Write a project scope of work for a ${project_type} construction project in Calgary, Alberta. Project: ${project_name}, estimated value $${contract_value}. Client: ${client_type}. Include: project overview, scope inclusions, scope exclusions, deliverables, quality standards (Alberta Building Code reference), safety requirements (WCB Alberta, CCOHS standards), environmental considerations, project schedule milestones, and payment terms. Professional construction contract language.`;
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json() as { response?: string };
      return Response.json({ result: data.response ?? '' });
    } catch {
      return Response.json({ result: `[AI Scope of Work — Offline Draft]\n\nProject: ${project_name}\nType: ${project_type} | Client Type: ${client_type} | Value: $${contract_value}\n\n1. PROJECT OVERVIEW\nThis scope covers all work required for the ${project_name} project per Alberta Building Code requirements.\n\n2. SCOPE INCLUSIONS\n• Site preparation and mobilization\n• All labour, materials, equipment as specified\n• Coordination with subcontractors\n\n3. SCOPE EXCLUSIONS\n• Owner-supplied materials unless noted\n• Work beyond property boundaries\n\n4. QUALITY STANDARDS\n• Alberta Building Code (ABC) 2019\n• CSA standards as applicable\n\n5. SAFETY REQUIREMENTS\n• WCB Alberta compliance mandatory\n• CCOHS safety standards\n• Site-specific safety plan required\n\n6. PAYMENT TERMS\n• Progress billings per schedule of values\n• Net 30 days from invoice date`, fallback: true });
    }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
