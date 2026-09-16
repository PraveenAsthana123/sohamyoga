import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const {
      service_name, duration_minutes, pressure_used, areas_focused,
      health_conditions, client_name, therapist,
    } = body;

    const prompt = `Write professional massage therapy treatment notes for: ${service_name || 'massage session'}, ${duration_minutes || 60} minutes, ${pressure_used || 'medium'} pressure, areas focused: ${Array.isArray(areas_focused) ? areas_focused.join(', ') : (areas_focused || 'full body')}. Client: ${client_name || 'client'}. Client conditions: ${Array.isArray(health_conditions) && health_conditions.length ? health_conditions.join(', ') : 'none reported'}. Therapist: ${therapist || 'RMT'}. Include: findings, techniques used, client response, areas of tension noted, aftercare provided, and recommendations for next session. Clinical, professional format suitable for insurance documentation.`;

    let notes = '';
    try {
      const aiRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json() as { response?: string };
        notes = aiData.response || '';
      }
    } catch {
      // Fallback treatment notes
      notes = `MASSAGE THERAPY TREATMENT RECORD\n\nClient: ${client_name || 'Client'}\nTherapist: ${therapist || 'RMT'}\nService: ${service_name || 'Massage'} — ${duration_minutes || 60} min\nPressure: ${pressure_used || 'Medium'}\n\nAREAS TREATED: ${Array.isArray(areas_focused) ? areas_focused.join(', ') : 'Full body'}\n\nSUBJECTIVE: Client reported areas of tension and discomfort. Health conditions reviewed: ${Array.isArray(health_conditions) && health_conditions.length ? health_conditions.join(', ') : 'none reported'}.\n\nOBJECTIVE: Tissue assessment revealed areas of hypertonicity and restricted movement. Treatment focused on identified areas using appropriate massage techniques.\n\nASSESSMENT: Client tolerated treatment well with positive response to pressure and techniques applied.\n\nPLAN: Continue with recommended treatment frequency. Review progress at next session. Homecare exercises provided.\n\n[AI service unavailable — please complete notes manually]`;
    }

    return Response.json({ notes });
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
