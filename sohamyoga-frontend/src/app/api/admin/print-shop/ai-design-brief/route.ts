import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  try {
    const body = await req.json();
    const { product_type, company, industry, goal, colors, message } = body;
    const prompt = `Create a detailed design brief for a ${product_type} print project. Client: ${company}, Industry: ${industry}. Goal: ${goal}. Brand colors: ${colors}. Key message: ${message}. Include: design direction, typography recommendations, imagery style, layout suggestions, what to avoid, and file delivery specifications. Professional creative brief format.`;
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama unavailable');
    const data = await res.json();
    return NextResponse.json({ brief: data.response });
  } catch {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ brief: `DESIGN BRIEF\n\nProject: ${body.product_type?.replace(/_/g,' ') ?? 'N/A'}\nClient: ${body.company ?? 'N/A'}\nIndustry: ${body.industry ?? 'N/A'}\nGoal: ${body.goal ?? 'N/A'}\nBrand Colors: ${body.colors ?? 'N/A'}\nKey Message: ${body.message ?? 'N/A'}\n\nFile Delivery Specifications:\n- Format: PDF/X-1a or PDF/X-4\n- Resolution: 300 DPI\n- Bleed: 0.125"\n- Color Profile: CMYK / Fogra39\n\n[AI generation unavailable — please complete brief manually]` });
  }
}
