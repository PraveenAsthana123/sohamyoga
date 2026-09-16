import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const b = await req.json();
  const prompt = `Write a speech therapy progress report for: ${b.client_name || 'Client'}, age ${b.age || 'unknown'}, ${b.primary_diagnosis || 'speech-language delay'}. SLP: ${b.slp || 'SLP on file'}. Reporting period: ${b.period || 'current term'}. Sessions completed: ${b.sessions_count || 0}. Goals addressed: ${(b.goals || []).join('; ') || 'not specified'}. Progress summary: ${b.progress_notes || 'see clinical notes'}. Include: introduction, goals with progress data (baseline → current accuracy), clinical interpretation, recommendations (continue/modify/discharge), home program summary, and signature block. Professional SLP report format for Alberta.`;
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return Response.json({ report: data.response });
  } catch {
    return Response.json({
      report: `SPEECH-LANGUAGE PATHOLOGY PROGRESS REPORT\n(AI unavailable — template)\n\nClient: ${b.client_name || '[Name]'} | Age: ${b.age || '[Age]'} | Diagnosis: ${b.primary_diagnosis || '[Diagnosis]'}\nReporting SLP: ${b.slp || '[SLP Name], R.SLP'}\nReporting Period: ${b.period || '[Period]'} | Sessions Completed: ${b.sessions_count || 0}\n\nINTRODUCTION:\n${b.client_name || 'The client'} was seen for individual speech-language therapy services. This report summarizes progress toward established communication goals.\n\nGOALS AND PROGRESS:\n${(b.goals || ['Goal 1 — see clinical file']).map((g:string, i:number)=>`Goal ${i+1}: ${g}\n  Baseline: [see intake assessment]\n  Current Accuracy: [based on session data]\n  Status: In Progress`).join('\n\n')}\n\nCLINICAL INTERPRETATION:\nClient demonstrates [progress level] response to intervention. Attendance has been [consistent/inconsistent].\n\nRECOMMENDATIONS:\n[ ] Continue current goals and frequency\n[ ] Modify goals — see attached updated plan\n[ ] Discharge — goals achieved\n\nHOME PROGRAM:\nCaregiver to complete 10-minute daily practice sessions using provided materials.\n\n_______________________\n${b.slp || '[SLP Name]'}, R.SLP, M.Sc.(S-LP)\nRegistered Speech-Language Pathologist — Alberta\nDate: ${new Date().toLocaleDateString('en-CA')}`,
      fallback: true
    });
  }
}
