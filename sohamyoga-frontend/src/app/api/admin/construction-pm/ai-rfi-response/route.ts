import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { project_name, subject, trade, description } = await req.json();
    const prompt = `Draft an RFI response for construction project ${project_name}. RFI Subject: ${subject}. Trade: ${trade}. Question: ${description}. Include: direct answer, technical reasoning, applicable code references (Alberta Building Code, CSA standards), any cost/schedule implications, and required documentation. Professional construction documentation format.`;
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
      return Response.json({ result: `[RFI RESPONSE — Offline Draft]\n\nProject: ${project_name}\nRFI Subject: ${subject} | Trade: ${trade}\n\nDIRECT ANSWER:\nReferring to the contract documents and applicable codes, the resolution for "${subject}" is as follows:\n\nTECHNICAL REASONING:\nPer Alberta Building Code Section applicable to ${trade} work, the specified approach shall govern. Where conflicts exist between drawings, the more stringent requirement applies.\n\nCODE REFERENCES:\n• Alberta Building Code 2019\n• CSA Standards applicable to ${trade}\n• Project specifications Sections as noted\n\nCOST/SCHEDULE IMPLICATIONS:\nTo be assessed pending design clarification. Contractor to submit change order request if applicable.\n\nREQUIRED DOCUMENTATION:\n• Revised drawing or clarification sketch\n• Written confirmation from Engineer of Record`, fallback: true });
    }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
