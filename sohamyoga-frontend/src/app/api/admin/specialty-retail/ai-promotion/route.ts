import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const prompt = `Create a retail promotion campaign for a specialty boutique in Calgary. Product/category: ${body.category || 'all products'}. Season: ${body.season || 'current season'}. Goal: ${body.goal || 'drive foot traffic and sales'}. Budget: ${body.budget || 'moderate'}. Include: promotion mechanic (BOGO/discount/loyalty bonus), promotional message, Instagram caption, email subject line, in-store signage copy, and timing recommendation. Alberta retail market context (Stampede season, Back to School, Christmas, etc.)`;
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      return NextResponse.json({ campaign: data.response, generated_by: 'ollama' });
    } catch {
      return NextResponse.json({
        campaign: `Promotion Campaign — ${body.category || 'Boutique'} (${body.season || 'Current Season'})\n\n**Mechanic:** 20% off on all ${body.category || 'items'} + 2x loyalty points\n\n**Promo Message:** "Treat yourself to something special — ${body.season || 'this season'}'s must-haves, now 20% off!"\n\n**Instagram Caption:** "✨ It's your season, Calgary! Shop our ${body.category || 'boutique'} collection and save 20% — plus earn double loyalty points all weekend. Tag a friend who deserves a treat! #YYCBoutique #ShopLocal #CalgaryStyle"\n\n**Email Subject:** "Your exclusive 20% savings are waiting, [Name]!"\n\n**In-Store Signage:** "WEEKEND SPECIAL\\n20% OFF + 2X POINTS\\n${body.category || 'Select Items'}\\nToday Only"\n\n**Timing:** Run Thursday–Sunday for maximum weekend foot traffic. Alberta Stampede season (July): extend to 2 weeks.\n\n*AI service offline — customize and review before publishing.*`,
        generated_by: 'fallback',
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
