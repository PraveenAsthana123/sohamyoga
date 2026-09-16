import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { engagement_type, company_name, industry, description, lead_consultant, total_fee, contract_type } = await req.json();

  const prompt = `Write a management consulting engagement proposal for: ${engagement_type} engagement at ${company_name} in ${industry}. Client challenge: ${description}. Team: ${lead_consultant}. Fee: $${total_fee} (${contract_type}). Include: executive summary, problem statement, proposed approach (3-4 phases), team qualifications, deliverables, timeline (week-by-week milestones), investment summary, and credentials section. Professional McKinsey-style proposal format. Calgary, Alberta business context.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return Response.json({ proposal: data.response });
  } catch {
    return Response.json({
      proposal: `ENGAGEMENT PROPOSAL\n${company_name} — ${engagement_type?.replace(/_/g,' ').toUpperCase()} ENGAGEMENT\n\nEXECUTIVE SUMMARY\nWe propose a structured ${engagement_type?.replace(/_/g,' ')} engagement designed to address the core business challenge at ${company_name}. Our team brings deep ${industry} expertise and a proven methodology to deliver measurable outcomes.\n\nPROBLEM STATEMENT\n${description}\n\nPROPOSED APPROACH\nPhase 1 (Weeks 1-2): Discovery & Diagnostic — Stakeholder interviews, data gathering, current-state assessment\nPhase 2 (Weeks 3-5): Analysis & Framework — Root-cause analysis, benchmarking, option generation\nPhase 3 (Weeks 6-9): Recommendations — Prioritized roadmap, business case, implementation blueprint\nPhase 4 (Weeks 10-12): Implementation Support — Change management, quick-win execution, governance setup\n\nKEY DELIVERABLES\n• Current-state assessment report\n• Strategic options analysis\n• Implementation roadmap with KPIs\n• Executive presentation for board/leadership\n• 90-day quick-win tracker\n\nTEAM\nLead Consultant: ${lead_consultant}\n\nINVESTMENT\nFee: $${total_fee} (${contract_type})\nPayment: 30% on signing, 40% at Phase 2 delivery, 30% on final delivery\n\n[Generated offline — Ollama unavailable]`,
      fallback: true,
    });
  }
}
