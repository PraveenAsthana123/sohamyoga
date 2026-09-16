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
    const projectRow = await client.query('SELECT * FROM anim_projects WHERE id = $1', [id]);
    if (projectRow.rowCount === 0) return Response.json({ error: 'Project not found' }, { status: 404 });

    const p = projectRow.rows[0];
    const prompt = `You are a professional animation director. Generate a comprehensive animation brief for:

Project: ${p.name}
Type: ${p.type}
Style: ${p.style || 'not specified'}
Duration: ${p.duration_seconds} seconds
Client: ${p.client || 'internal'}
Brief overview: ${p.brief || 'No brief provided'}
Complexity: ${p.complexity}

Create a full animation production brief with these sections:
1. STYLE GUIDE — visual language, color palette (primary/secondary/accent hex codes), typography, motion language (easing, timing principles)
2. SCENE BREAKDOWN — 4-6 scenes with scene number, duration, description, key animation, voiceover/text
3. VOICEOVER SUGGESTIONS — tone, pace, sample script lines (3-4)
4. KEY ANIMATION MOMENTS — 3-5 hero animation beats that must land perfectly
5. TECHNICAL SPEC — frame rate, resolution, export formats, software recommendation

Format clearly with headers and bullet points. Be specific and actionable.`;

    let brief = '';
    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        brief = data.response || '';
      }
    } catch { /* fallback */ }

    if (!brief) {
      brief = `ANIMATION BRIEF: ${p.name}\n\n1. STYLE GUIDE\n- Visual Language: ${p.style || 'Clean, modern'} — clear hierarchy, purposeful motion\n- Color Palette: Primary #1e1b4b (brand navy), Secondary #7c3aed (violet), Accent #f59e0b (amber)\n- Typography: Bold, legible sans-serif. Headlines at 120% of body text.\n- Motion Language: Ease-in-out curves, 0.3s standard transitions, 0.8s hero moments\n\n2. SCENE BREAKDOWN\n- Scene 1 (${Math.round(p.duration_seconds * 0.15)}s): Opening hook — bold title animation\n- Scene 2 (${Math.round(p.duration_seconds * 0.25)}s): Problem statement — relatable situation\n- Scene 3 (${Math.round(p.duration_seconds * 0.35)}s): Solution presentation — core animation moments\n- Scene 4 (${Math.round(p.duration_seconds * 0.15)}s): Benefits highlight — icon/stat animation\n- Scene 5 (${Math.round(p.duration_seconds * 0.10)}s): CTA — logo + call to action\n\n3. VOICEOVER SUGGESTIONS\n- Tone: Warm, authoritative, conversational\n- Pace: ~130 WPM with deliberate pauses\n- Sample: "Every breath tells a story. At ${p.client || 'Soham Yoga'}, we help you write yours."\n\n4. KEY ANIMATION MOMENTS\n- Logo reveal with satisfying entrance\n- Core message text kinetic reveal\n- Statistics counter animation\n- Character or element interaction scene\n\n5. TECHNICAL SPEC\n- Frame Rate: 24fps (cinematic) or 30fps (web)\n- Resolution: 1920x1080 (16:9) + 1080x1920 (9:16 cutdown)\n- Export: H.264 MP4, ProRes 422 master, WebM\n- Software: After Effects (motion graphics), Blender (3D), Rive (interactive)`;
    }

    await client.query('UPDATE anim_projects SET brief = $1, status = CASE WHEN status = \'concept\' THEN \'storyboard\' ELSE status END WHERE id = $2', [brief, id]);

    return Response.json({ brief, generated: true });
  } finally {
    client.release();
  }
}
