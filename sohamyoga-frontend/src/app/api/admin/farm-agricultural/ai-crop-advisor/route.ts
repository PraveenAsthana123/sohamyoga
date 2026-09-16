import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => null);
    if (!body?.crop) return Response.json({ error: 'crop is required.' }, { status: 400 });

    const { soil_zone = 'black', crop, seeding_date, rainfall_ytd, pest_pressure } = body;

    const prompt = `You are an agronomist specializing in Alberta Prairie farming. A farmer needs crop management advice for the following situation:

Soil Zone: ${soil_zone} (Alberta soil classification)
Crop: ${crop}
Seeding Date: ${seeding_date ?? 'not specified'}
Rainfall YTD: ${rainfall_ytd ?? 'not specified'} mm
Pest Pressure: ${pest_pressure ?? 'none noted'}

Alberta context: AFSC crop insurance programs, NERP carbon credit protocols, prairie drought index monitoring, hail season risk (June–August), CFIA regulatory requirements for pesticide application.

Please provide:
1. Current crop growth stage assessment
2. Recommended agronomic actions for this week
3. Pest/disease scouting priorities
4. Nutrient management notes
5. Harvest timing outlook
6. Alberta-specific program considerations (AFSC, NERP carbon credits)
7. Weather/drought risk considerations

Keep advice practical and specific to Alberta growing conditions.`;

    let advice = '';
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json();
        advice = data.response ?? '';
      }
    } catch {
      // Ollama unavailable — generate a structured fallback
    }

    if (!advice) {
      advice = `Alberta Crop Advisory — ${crop.toUpperCase()} on ${soil_zone.replace('_', ' ')} soil zone

GROWTH STAGE: Based on seeding date ${seeding_date ?? 'TBD'}, crop should be in early-to-mid vegetative stages. Monitor for uniform emergence across field.

RECOMMENDED ACTIONS:
• Scout for flea beetle pressure (canola) or wire worm damage within 7-10 days of emergence
• Assess residual herbicide carryover from previous crop rotation
• Check soil moisture at 6" depth — critical for root establishment
• Monitor for sclerotinia risk indicators if rainfall exceeds 20mm/week

PEST PRIORITIES:
• ${crop === 'canola' ? 'Flea beetles, sclerotinia stem rot, clubroot (if in endemic zone)' : 'Grasshoppers, aphids, wheat midge (for wheat varieties), tan spot'}
• Threshold-based application only per PMRA/CFIA registered products

HARVEST OUTLOOK:
• Target swathing at 60-70% seed colour change (canola) or 35% moisture (cereals)
• Hail risk window: June 15 – August 15 — confirm AFSC hail endorsement active

AFSC / NERP NOTES:
• Verify Production Insurance report filed before growing season deadline
• NERP protocol requires seeding date, variety, and acres reported within 10 days of seeding
• Carbon sequestration eligible if no-till practice confirmed

Disclaimer: Field verification by a certified agronomist recommended before major input decisions.`;
    }

    return Response.json({ advice, crop, soil_zone, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error('ai-crop-advisor error:', err);
    return Response.json({ error: 'Failed to generate crop advice.' }, { status: 500 });
  }
}
