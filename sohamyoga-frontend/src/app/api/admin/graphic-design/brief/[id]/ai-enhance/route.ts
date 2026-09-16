import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const { id } = await params;
  const pool = getPool();
  const row = await pool.query(`SELECT * FROM design_briefs WHERE id = $1`, [id]);
  if (!row.rowCount) return Response.json({ error: 'Brief not found.' }, { status: 404 });

  const brief = row.rows[0];
  const prompt = `You are a creative director. Enhance this design brief for a ${brief.project_type} for ${brief.brand_name || 'the brand'}. Key message: ${brief.key_message || 'not specified'}. Mood: ${brief.mood_tone || 'not specified'}. Target audience: ${brief.target_audience || 'general audience'}. Write a detailed creative brief including: visual direction, typography guidance, color psychology rationale, composition tips, do's and don'ts. Be specific and actionable.`;

  let aiText = '';
  try {
    const ollamaRes = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(60_000),
    });

    if (ollamaRes.ok) {
      const data = await ollamaRes.json() as { response?: string };
      aiText = data.response?.trim() || '';
    } else {
      aiText = `[Ollama unavailable — ${ollamaRes.status}] Fallback brief: For a ${brief.project_type} targeting ${brief.target_audience || 'your audience'}, use ${brief.mood_tone || 'professional'} visual direction. Lead with the key message "${brief.key_message || brief.title}" in a clear hierarchy. Stick to brand colors for consistency, use generous whitespace, and ensure the call-to-action is prominent.`;
    }
  } catch {
    aiText = `[Ollama offline] Fallback brief: For this ${brief.project_type}, focus on ${brief.mood_tone || 'clean, professional'} aesthetics. Typography should establish clear hierarchy. Lead visuals should reinforce the key message: "${brief.key_message || brief.title}". Maintain brand consistency with the specified color palette.`;
  }

  const updated = await pool.query(
    `UPDATE design_briefs SET ai_brief = $2 WHERE id = $1 RETURNING *`,
    [id, aiText]
  );

  return Response.json({ ok: true, ai_brief: aiText, brief: updated.rows[0] });
}
