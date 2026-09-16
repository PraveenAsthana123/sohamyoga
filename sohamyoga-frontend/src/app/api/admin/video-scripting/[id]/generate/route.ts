import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id, 10);
    const scriptRow = await client.query('SELECT * FROM vs_scripts WHERE id = $1', [id]);
    if (scriptRow.rowCount === 0) return Response.json({ error: 'Script not found' }, { status: 404 });

    const s = scriptRow.rows[0];
    const prompt = `You are a professional video scriptwriter. Generate a complete video script for the following brief:

Project: ${s.project_name}
Video Type: ${s.video_type}
Duration: ${s.duration_seconds} seconds
Target Audience: ${s.target_audience || 'General audience'}
Key Message: ${s.key_message || 'Not specified'}

Write a structured script with these exact sections:
HOOK (first 5-8 seconds to grab attention)
BODY (main content, evidence, story)
CTA (call-to-action, last 5-10 seconds)

For each section include: [VISUAL], [VO] (voiceover), and [ON-SCREEN TEXT] markers.
Keep it concise and punchy. Total word count should match a ${s.duration_seconds}-second video at ~130 WPM.
Return only the script text, no preamble.`;

    let scriptText = '';
    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        scriptText = data.response || '';
      }
    } catch {
      // Fallback script
      scriptText = `HOOK\n[VISUAL]: Dynamic opening shot — action in progress\n[VO]: ${s.key_message || 'Discover what changes everything.'}\n[ON-SCREEN TEXT]: ${s.project_name}\n\nBODY\n[VISUAL]: Core demonstration or story\n[VO]: For ${s.target_audience || 'our audience'}, this is the difference that matters. We show you exactly how ${s.video_type} content delivers on the promise.\n[ON-SCREEN TEXT]: Key benefit #1 | Key benefit #2 | Key benefit #3\n\nCTA\n[VISUAL]: Logo on clean background\n[VO]: Ready to start? Visit us today.\n[ON-SCREEN TEXT]: Get Started Now → sohamyoga.ca`;
    }

    await client.query(
      `UPDATE vs_scripts SET script_text = $1, status = 'in_review', version = version + 1 WHERE id = $2`,
      [scriptText, id]
    );

    return Response.json({ script_text: scriptText, generated: true });
  } finally {
    client.release();
  }
}
