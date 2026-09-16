import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json();
  const { move_type = 'local', origin_address = '', destination_address = '', home_size = '2', special_items = '', packing_service = false } = b;

  const prompt = `Generate a moving quote for a ${move_type.replace('_',' ')} move in Calgary, Alberta. Origin: ${origin_address || 'Calgary, AB'}, Destination: ${destination_address || 'Calgary, AB'}. Home size: ${home_size} bedrooms. Special items: ${special_items || 'none'}. Packing service: ${packing_service ? 'Yes' : 'No'}. Include: estimated hours, crew size, truck size needed, price breakdown (hourly rate × hours + fuel surcharge + GST 5%), packing materials estimate, what's included/excluded, tips for moving day, and Calgary-specific notes (parking permits, elevator booking, condo rules).`;

  const hourlyRate = move_type === 'local' ? 145 : 165;
  const estimatedHours = parseInt(home_size) * 2 + 1;
  const subtotal = hourlyRate * estimatedHours;
  const fuel = Math.round(subtotal * 0.05);
  const gst = Math.round((subtotal + fuel) * 0.05);
  const total = subtotal + fuel + gst;

  const fallback = `MOVING QUOTE — ${move_type.replace(/_/g,' ').toUpperCase()}\n\nOrigin: ${origin_address || 'TBD'}\nDestination: ${destination_address || 'TBD'}\nHome Size: ${home_size} bedrooms\n\nESTIMATED BREAKDOWN:\n• Estimated Hours: ${estimatedHours}h\n• Crew: ${parseInt(home_size) >= 3 ? 3 : 2} movers\n• Truck: ${parseInt(home_size) >= 3 ? '20ft' : '16ft'}\n• Hourly Rate: $${hourlyRate}/hr\n• Labour: $${subtotal.toFixed(2)}\n• Fuel Surcharge: $${fuel.toFixed(2)}\n• GST (5%): $${gst.toFixed(2)}\n• TOTAL: $${total.toFixed(2)}\n\nINCLUDED:\n• Professional movers & truck\n• Moving blankets & straps\n• Basic disassembly/reassembly\n• $100K cargo insurance\n\nNOT INCLUDED:\n• Packing materials (estimate $150-300)\n• Long-carry charges over 75ft\n• Stair fees (3+ flights): $75/flight\n\nCALGARY NOTES:\n• Elevator booking: coordinate with building management 48-72 hrs ahead\n• Parking permits: contact City of Calgary if street parking needed\n• Condo rules: check move-in hours (typically 9am-5pm weekdays)\n\nMOVING DAY TIPS:\n• Defrost freezer 24hrs before\n• Label boxes by room\n• Keep valuables with you`;

  let quote = fallback;
  try {
    const aiRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (aiRes.ok) {
      const data = await aiRes.json();
      if (data.response) quote = data.response.trim();
    }
  } catch { /* use fallback */ }

  return Response.json({ quote, estimated_total: total, generated_at: new Date().toISOString() });
}
