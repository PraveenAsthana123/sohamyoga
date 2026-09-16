import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const { placement, size_inches, style, colors = 'black_grey' } = body;

  if (!placement || !style) {
    return NextResponse.json({ error: 'placement and style required' }, { status: 400 });
  }

  const prompt = `Write professional tattoo aftercare instructions for: ${placement} placement, ${size_inches ? `${size_inches} inch` : ''} ${style} tattoo in ${colors.replace('_',' ')}. Include: immediate aftercare (first 24 hours), short-term care (weeks 1-2), long-term healing (weeks 2-6), signs of infection to watch for, products to use/avoid, sun protection, and when to call the studio. Professional, clear language. Reference Alberta Health Services tattoo aftercare guidelines.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return NextResponse.json({ aftercare: data.response });
  } catch {
    return NextResponse.json({
      aftercare: `TATTOO AFTERCARE — ${placement.toUpperCase()} PLACEMENT\n\n**First 24 Hours:**\n• Keep wrap on for 2-4 hours\n• Gently wash with fragrance-free soap\n• Pat dry, do not rub\n• Apply thin layer of unscented moisturizer\n\n**Weeks 1-2:**\n• Wash 2-3x daily\n• Moisturize regularly\n• Do not scratch or pick\n• Avoid sun, pools, and soaking\n\n**Weeks 2-6:**\n• Continue moisturizing\n• Use SPF 50+ on healed tattoo\n\n**Contact the studio if:**\n• Excessive redness, swelling, or pus\n• Fever or red streaking\n• Unusual pain after day 3\n\n*Per Alberta Health Services guidelines.*`,
      fallback: true,
    });
  }
}
