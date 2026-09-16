import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const b = await req.json();
  const prompt = `Create an acupuncture point prescription for: TCM pattern: ${b.pattern || ''}, Chief complaint: ${b.chief_complaint || ''}, Constitution: ${b.tcm_constitution || 'not specified'}. Include: primary points (6-10) with locations and functions, secondary points (4-6), point combination rationale, needling technique (depth, angle, stimulation method), contraindications for this patient, suggested herbal formula, and lifestyle/dietary recommendations. Evidence-based TCM approach.`;
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return Response.json({ prescription: data.response });
  } catch {
    return Response.json({ prescription: `[AI unavailable] Point Prescription for ${b.pattern || 'TCM Pattern'}:\n\nPrimary Points:\n- ST36 (Zusanli) — tonify Qi and Blood\n- SP6 (Sanyinjiao) — strengthen Spleen, nourish Yin\n- LI4 (Hegu) — move Qi, analgesic\n- LV3 (Taichong) — smooth Liver Qi\n- CV6 (Qihai) — tonify Yuan Qi\n- KD3 (Taixi) — tonify Kidney Yin/Yang\n\nSecondary Points (based on presentation):\n- GV20 (Baihui) — clear mind, raise Yang\n- HT7 (Shenmen) — calm Shen\n- PC6 (Neiguan) — regulate Heart Qi\n- BL23 (Shenshu) — tonify Kidney\n\nNeedling technique: perpendicular insertion, 1–1.5 cun depth, mild reinforcing technique.\n\nPlease regenerate when AI is available for patient-specific prescription.` });
  }
}
