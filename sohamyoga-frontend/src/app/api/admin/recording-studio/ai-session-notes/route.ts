import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { session_type, tracks_recorded, notes } = await req.json();
    const prompt = `You are a professional music studio session manager. Write detailed, professional session notes for the following recording session.

Session Type: ${session_type || 'Recording'}
Tracks Recorded: ${Array.isArray(tracks_recorded) ? tracks_recorded.join(', ') : tracks_recorded || 'Not specified'}
Engineer Notes: ${notes || 'None provided'}

Write comprehensive session notes covering: what was accomplished, technical details, tracks recorded or worked on, next steps, and any issues encountered. Keep it professional and suitable for client delivery. Format with clear sections.`;

    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return Response.json({ notes: data.response });
  } catch {
    return Response.json({
      notes: `Session Notes — ${new Date().toLocaleDateString('en-CA')}\n\nSession completed as scheduled. Tracks recorded and reviewed per project plan. Engineer confirmed all takes at satisfactory technical standard. Files backed up to project drive. Next session to be scheduled with client confirmation.\n\n[AI generation unavailable — placeholder provided]`,
      fallback: true,
    });
  }
}
