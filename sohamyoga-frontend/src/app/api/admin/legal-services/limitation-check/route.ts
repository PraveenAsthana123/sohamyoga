export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { matter_type, incident_date, province } = body;

  if (!matter_type) return Response.json({ error: 'matter_type required' }, { status: 400 });

  const disclaimer = `\n\n⚠️ IMPORTANT DISCLAIMER: This is general information only and does NOT constitute legal advice. Limitation periods are complex, fact-specific, and can be affected by many factors including discovery rules, special circumstances, and legislative amendments. Always consult a licensed ${province || 'Canadian'} lawyer IMMEDIATELY to determine the applicable limitation period for your specific situation. Missing a limitation period can permanently bar a claim.`;

  const prompt = `You are a Canadian legal information assistant. Provide general information about limitation periods.

Matter type: ${matter_type}
Province: ${province || 'Alberta'}
Incident date (if provided): ${incident_date || 'Not specified'}

Provide general information about:
1. The typical limitation period for this type of matter in ${province || 'Alberta'}
2. The general rule for when time starts running
3. Any common exceptions or extensions that may apply
4. Key considerations for this matter type

Note: Alberta's Limitations Act (SA 2000, c L-12) generally sets a 2-year basic limitation period. Be precise about what you know vs. what requires legal advice.`;

  try {
    const resp = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) throw new Error('Ollama error');
    const data = await resp.json();
    return Response.json({ result: data.response + disclaimer, matter_type, province, incident_date });
  } catch {
    return Response.json({
      result: `[Limitation Period Reference — AI temporarily unavailable]\n\nGeneral note: In Alberta, the basic limitation period is generally 2 years from when the claim was or ought to have been discovered (Limitations Act, SA 2000, c L-12). Consult a lawyer immediately.${disclaimer}`,
      fallback: true,
    });
  }
}
