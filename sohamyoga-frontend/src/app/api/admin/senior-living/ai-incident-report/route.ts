import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  try {
    const { resident_name, incident_type, severity, occurred_at, location, description, immediate_action, staff_name, ahs_reportable } = await req.json();
    if (!incident_type || !description) return Response.json({ error: 'incident_type and description required' }, { status: 400 });

    const prompt = `You are a regulated health professional in Alberta drafting a formal incident report for submission to AHS (Alberta Health Services) continuing care operations. Use objective, professional clinical language with no subjective opinion.

Incident Details:
- Resident: ${resident_name || 'Resident'}
- Incident Type: ${incident_type}
- Severity: ${severity}
- Date/Time: ${occurred_at || 'unknown'}
- Location in Facility: ${location || 'not specified'}
- Staff Name: ${staff_name || 'not specified'}
- AHS Reportable: ${ahs_reportable ? 'YES — mandatory AHS notification required within 24 hours' : 'No'}
- What Happened: ${description}
- Immediate Action Taken: ${immediate_action || 'see narrative'}

Draft a formal AHS-style incident narrative report with these sections:
1. INCIDENT SUMMARY (2–3 sentences, objective)
2. CHRONOLOGICAL NARRATIVE (step-by-step timeline of events)
3. IMMEDIATE RESPONSE & INTERVENTIONS
4. RESIDENT STATUS AT TIME OF REPORT
5. NOTIFICATIONS MADE (physician, family, AHS, RAP if applicable)
6. CORRECTIVE ACTIONS & PREVENTION PLAN
7. SIGNATURE BLOCK (to be completed manually)

Adhere to AHS documentation standards. Do not speculate about causation without evidence.`;

    let aiText = '';
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json() as { response?: string };
        aiText = data.response || '';
      }
    } catch {
      // Ollama unavailable — structured fallback
    }
    if (!aiText) {
      const ts = occurred_at ? new Date(occurred_at).toLocaleString('en-CA', { timeZone: 'America/Edmonton' }) : 'unknown time';
      aiText = `AHS INCIDENT REPORT — DRAFT\nFacility: [FACILITY NAME] | Date Generated: ${new Date().toLocaleDateString('en-CA')}\n\n` +
        `1. INCIDENT SUMMARY\nOn ${ts}, a ${severity}-severity ${incident_type} incident occurred involving resident ${resident_name || 'the named resident'} in the ${location || 'facility'}. Immediate interventions were initiated per facility protocol.\n\n` +
        `2. CHRONOLOGICAL NARRATIVE\n[TIME]: ${description}\n[Staff ${staff_name || 'on duty'} responded immediately.]\n\n` +
        `3. IMMEDIATE RESPONSE & INTERVENTIONS\n${immediate_action || 'Standard facility protocol followed. Vital signs assessed. Physician notified per protocol.'}\n\n` +
        `4. RESIDENT STATUS AT TIME OF REPORT\n[To be completed by staff: current vital signs, level of consciousness, complaints, visible injuries.]\n\n` +
        `5. NOTIFICATIONS MADE\n• Physician: [ ] Yes  [ ] No — Time: ___  Name: ___\n• Family/Emergency Contact: [ ] Yes  [ ] No — Time: ___\n` +
        (ahs_reportable ? `• AHS Regional Director: REQUIRED within 24 hours per CCHSS s.83\n• RAP (Resident Advocate Program): notify if requested\n` : `• AHS notification: not required for this severity level\n`) +
        `\n6. CORRECTIVE ACTIONS & PREVENTION PLAN\n• Immediate: Environmental hazard removed/mitigated\n• Short-term (48 hrs): Care plan reviewed and updated\n• Long-term: Staff education; root cause analysis at next safety huddle\n\n` +
        `7. SIGNATURE BLOCK\nReport completed by: ___________________________ Date/Time: ___________\nWitness: ___________________________ Role: ___________\nDirector of Care review: ___________________________ Date: ___________\n\n` +
        `[Note: AI service offline — this is a structured template. All bracketed fields must be completed with verified clinical data before submission.]`;
    }
    return Response.json({ incident_report: aiText });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
