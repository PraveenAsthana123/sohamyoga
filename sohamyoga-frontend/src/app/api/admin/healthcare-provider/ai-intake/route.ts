export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { symptoms, age, existing_conditions } = body;

  if (!symptoms) return Response.json({ error: 'symptoms is required' }, { status: 400 });

  const prompt = `You are a Canadian healthcare intake assistant helping clinic staff triage patients.
Patient profile: Age ${age || 'unknown'}, Conditions: ${(existing_conditions || []).join(', ') || 'none reported'}.
Presenting symptoms: ${symptoms}

Provide a structured intake summary with:
1. Suggested service type (one of: consultation, chiropractic, physiotherapy, dental_cleaning, dental_exam, optometry, psychology, naturopathy, massage, lab_work, vaccination, home_care)
2. Urgency level (routine, semi-urgent, urgent, emergency)
3. Clinical questions to ask the patient before their appointment (3-5 questions)
4. Any red flag symptoms to watch for
5. Suggested appointment duration

Keep it professional, brief, and Canadian healthcare context-aware. This is for clinical staff use only.`;

  try {
    const resp = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) throw new Error('Ollama error');
    const data = await resp.json();
    return Response.json({ result: data.response, symptoms, age, existing_conditions });
  } catch {
    return Response.json({
      result: `Intake Summary (AI unavailable — manual assessment required)\n\nSymptoms reported: ${symptoms}\nAge: ${age || 'unknown'}\nConditions: ${(existing_conditions || []).join(', ') || 'none'}\n\nRecommended: Schedule a general consultation. Clinical staff to complete full intake at appointment.`,
      fallback: true,
    });
  }
}
