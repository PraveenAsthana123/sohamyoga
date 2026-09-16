import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { appointment_type, procedure_codes, findings } = body;
    if (!appointment_type) return Response.json({ error: 'appointment_type required' }, { status: 400 });

    const prompt = `You are a dental/medical clinical documentation assistant. Generate professional SOAP-format clinical notes for the following appointment:

Appointment Type: ${appointment_type}
Procedure Codes: ${procedure_codes?.join(', ') || 'Not specified'}
Clinical Findings: ${findings || 'Not provided'}

Generate comprehensive clinical notes with the following SOAP format:
S (Subjective): Patient's chief complaint, medical history relevant to this visit
O (Objective): Clinical findings, examination results, measurements, observations
A (Assessment): Clinical assessment, diagnosis, treatment performed
P (Plan): Follow-up recommendations, next appointment, home care instructions, recall interval

Use professional dental/medical terminology. Be specific and thorough. Include relevant details for each section.`;

    let notes = '';
    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        notes = data.response ?? '';
      }
    } catch {
      // Graceful fallback
    }

    if (!notes) {
      notes = `SOAP Clinical Notes — ${appointment_type.toUpperCase()}\n\nS (Subjective):\nPatient presented for scheduled ${appointment_type}. [AI service offline — provider to complete]\n\nO (Objective):\nProcedures performed: ${procedure_codes?.join(', ') || appointment_type}\nClinical findings: ${findings || '[Provider to document]'}\n\nA (Assessment):\n[Provider to complete clinical assessment]\n\nP (Plan):\n[Provider to document follow-up plan, recall interval, and home care instructions]\n\n⚠️ AI note generation offline. Please complete documentation manually. This template is for provider review and editing only.`;
    }

    return Response.json({
      notes,
      disclaimer: 'AI-generated draft for provider review and editing only. Not for direct use as clinical documentation.',
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
