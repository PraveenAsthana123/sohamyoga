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
    const scriptExcerpt = s.script_text ? s.script_text.slice(0, 1500) : `Project: ${s.project_name}, Type: ${s.video_type}, Key Message: ${s.key_message}`;

    const prompt = `You are a professional storyboard artist. Generate a storyboard for this video script:

${scriptExcerpt}

Project: ${s.project_name} (${s.duration_seconds}s ${s.video_type} video)

Create exactly 6 storyboard scenes. Return a valid JSON array with exactly this structure for each scene:
[
  {
    "scene": 1,
    "shot_type": "wide|medium|close_up|cutaway|aerial|pov",
    "description": "what the camera sees",
    "dialogue": "spoken words or empty string",
    "duration_sec": 10,
    "visual_notes": "lighting, color, camera movement notes"
  }
]

Make scenes flow logically. Total duration_sec should sum to approximately ${s.duration_seconds}.
Return ONLY the JSON array, no other text.`;

    let scenes: unknown[] = [];
    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        const raw = data.response || '';
        const match = raw.match(/\[[\s\S]*\]/);
        if (match) scenes = JSON.parse(match[0]);
      }
    } catch { /* use fallback */ }

    if (!scenes.length) {
      const perScene = Math.round(s.duration_seconds / 6);
      scenes = [
        { scene: 1, shot_type: 'wide', description: 'Opening establishing shot of key location', dialogue: '', duration_sec: perScene, visual_notes: 'Golden hour, cinematic framing' },
        { scene: 2, shot_type: 'medium', description: 'Subject introduction — facing camera', dialogue: s.key_message || 'Welcome...', duration_sec: perScene, visual_notes: 'Eye level, neutral background' },
        { scene: 3, shot_type: 'close_up', description: 'Product or action detail close-up', dialogue: 'Here is what makes it different...', duration_sec: perScene, visual_notes: 'Shallow depth of field, warm tones' },
        { scene: 4, shot_type: 'cutaway', description: 'B-roll: lifestyle or process shots', dialogue: '', duration_sec: perScene, visual_notes: 'Dynamic movement, montage style' },
        { scene: 5, shot_type: 'medium', description: 'Testimonial or benefit statement', dialogue: 'This changed everything for me.', duration_sec: perScene, visual_notes: 'Clean background, authentic feel' },
        { scene: 6, shot_type: 'wide', description: 'Brand close — logo and CTA on screen', dialogue: 'Start today.', duration_sec: perScene, visual_notes: 'Brand colors, high contrast CTA' },
      ];
    }

    const title = `${s.project_name} — Storyboard v${s.version}`;
    const result = await client.query(
      `INSERT INTO vs_storyboards (script_id, title, scenes, status) VALUES ($1, $2, $3, 'draft') RETURNING *`,
      [id, title, JSON.stringify(scenes)]
    );

    return Response.json({ storyboard: result.rows[0], scenes, generated: true }, { status: 201 });
  } finally {
    client.release();
  }
}
