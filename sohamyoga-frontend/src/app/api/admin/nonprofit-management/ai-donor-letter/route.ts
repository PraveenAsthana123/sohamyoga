import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const {
    donor_name, amount, organization_name = 'Our Charitable Organization',
    fund = 'general', campaign_name, giving_level = 'friend',
    charitable_reg_number = '123456789 RR 0001',
  } = body;

  if (!donor_name || !amount) {
    return NextResponse.json({ error: 'donor_name and amount required' }, { status: 400 });
  }

  const prompt = `Write a heartfelt donor thank-you letter for: ${donor_name} who donated $${amount} to ${organization_name} for ${fund} fund${campaign_name ? ` / ${campaign_name} campaign` : ''}. Giving level: ${giving_level}. Include: sincere gratitude, specific impact of their gift (be specific about programs funded), tax receipt info (Canada Revenue Agency registered charity, charitable registration number ${charitable_reg_number}), recognition of their ${giving_level} status, and a warm closing. Professional yet warm tone. Canadian charitable organization based in Calgary, Alberta.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return NextResponse.json({ letter: data.response });
  } catch {
    return NextResponse.json({
      letter: `Dear ${donor_name},\n\nThank you sincerely for your generous donation of $${amount} to ${organization_name}. Your gift to the ${fund} fund will make a meaningful difference in our community programs.\n\nAs a valued ${giving_level}-level supporter, your commitment to our mission is deeply appreciated. Your contribution is eligible for a charitable tax receipt from Canada Revenue Agency (Reg. No. ${charitable_reg_number}).\n\nWith heartfelt gratitude,\n${organization_name}`,
      fallback: true,
    });
  }
}
