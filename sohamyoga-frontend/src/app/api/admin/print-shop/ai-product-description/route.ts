import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  try {
    const body = await req.json();
    const { product_type, quantity, size, finish, color_mode } = body;
    const prompt = `Write a professional product description and specifications for a print order: ${product_type}, quantity ${quantity}, size ${size}, ${finish} finish, ${color_mode}. Target business customer in Calgary. Include: key features, best use cases, file setup specifications (bleed: 0.125in, resolution: 300dpi, color mode: CMYK), turnaround time, and a compelling benefit statement.`;
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama unavailable');
    const data = await res.json();
    return NextResponse.json({ description: data.response });
  } catch {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ description: `PRODUCT SPECIFICATION\n\nProduct: ${body.product_type?.replace(/_/g,' ') ?? 'N/A'}\nQuantity: ${body.quantity ?? 'N/A'}\nSize: ${body.size ?? 'N/A'}\nFinish: ${body.finish ?? 'N/A'}\nColor Mode: ${body.color_mode ?? 'N/A'}\n\nFile Setup:\n- Bleed: 0.125" on all sides\n- Resolution: 300 DPI minimum\n- Color Mode: CMYK\n- File Formats: PDF, AI, EPS preferred\n\n[AI generation unavailable — please complete specifications manually]` });
  }
}
