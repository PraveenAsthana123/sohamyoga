import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { service_type } = await req.json();

  const prompt = `Generate a detailed cleaning checklist for a ${service_type} service. Organize by room/area. Include time estimates per area, special attention points, products to use for each surface, and quality check items. Professional cleaning company format.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    return Response.json({ result: data.response, ai: true });
  } catch {
    const fallback = `CLEANING CHECKLIST — ${(service_type ?? 'standard').replace(/_/g,' ').toUpperCase()}

KITCHEN (30-45 min)
━━━━━━━━━━━━━━━━━━━━
[ ] Wipe all countertops (all-purpose cleaner)
[ ] Clean stovetop and burners (degreaser)
[ ] Wipe appliance exteriors (microwave, fridge, dishwasher)
[ ] Clean sink and faucet (bathroom cleaner / Bar Keepers Friend)
[ ] Wipe cabinet faces (damp cloth)
[ ] Clean inside microwave
[ ] Empty and reline trash bin
[ ] Sweep and mop floor (floor cleaner)
Quality check: No grease, no streaks, sink shiny

BATHROOMS (20-30 min each)
━━━━━━━━━━━━━━━━━━━━
[ ] Scrub toilet bowl (toilet cleaner + brush)
[ ] Wipe toilet exterior and base
[ ] Scrub tub/shower (bathroom cleaner / tub scrub)
[ ] Clean sink and faucet
[ ] Wipe mirror (glass cleaner — streak-free)
[ ] Wipe countertop and cabinet faces
[ ] Replace towels / fold if requested
[ ] Empty trash
[ ] Sweep and mop floor
Quality check: No soap scum, mirror streak-free, floor dry

BEDROOMS (15-20 min each)
━━━━━━━━━━━━━━━━━━━━
[ ] Dust furniture, lamps, baseboards (microfiber)
[ ] Wipe nightstands
[ ] Make bed (if linens provided)
[ ] Vacuum carpets / mop hardwood
Quality check: No visible dust, floor marks gone

LIVING AREAS (20-30 min)
━━━━━━━━━━━━━━━━━━━━
[ ] Dust all surfaces, electronics, shelves
[ ] Wipe glass surfaces (coffee table, TV stand)
[ ] Vacuum furniture (cushions, under cushions)
[ ] Vacuum / mop floors
[ ] Clean light switches and door handles
Quality check: Surfaces dust-free, floors clean

FINAL WALKTHROUGH
━━━━━━━━━━━━━━━━━━━━
[ ] All rooms checked
[ ] No products left behind
[ ] All lights off
[ ] Lockbox re-secured
[ ] Before/after photos taken

⚠️ AI checklist unavailable — this is a standard template.`;
    return Response.json({ result: fallback, ai: false });
  }
}
