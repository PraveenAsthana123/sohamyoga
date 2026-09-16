import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  try {
    const body = await req.json();
    const { incident_type, severity, incident_time, location, description, action_taken, police_called, witnesses } = body;

    const prompt = `Write a professional security incident report: Incident type: ${incident_type}, Severity: ${severity}, Date/Time: ${incident_time}, Location: ${location}. Description: ${description}. Action taken: ${action_taken}. Police called: ${police_called}. Witnesses: ${witnesses}. Format: formal security report with incident number, summary paragraph, chronological account, guard actions, evidence noted, recommendations, and signature block. Alberta security industry standard.`;

    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error('Ollama unavailable');
    const data = await res.json();
    return NextResponse.json({ report: data.response });
  } catch {
    const body = await req.json().catch(() => ({}));
    const fallback = `SECURITY INCIDENT REPORT\n\nIncident Type: ${body.incident_type ?? 'N/A'}\nSeverity: ${body.severity ?? 'N/A'}\nDate/Time: ${body.incident_time ?? 'N/A'}\nLocation: ${body.location ?? 'N/A'}\n\nDescription:\n${body.description ?? 'N/A'}\n\nAction Taken:\n${body.action_taken ?? 'N/A'}\n\nPolice Called: ${body.police_called ? 'Yes' : 'No'}\nWitnesses: ${body.witnesses ?? 'None'}\n\n[AI generation unavailable — please complete manually per Alberta Security Services Act reporting standards]`;
    return NextResponse.json({ report: fallback });
  }
}
