export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const config = await client.query('SELECT * FROM conversational_ai_config WHERE id=$1', [params.id]);
    if (!config.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const bot = config.rows[0];
    const b = await req.json().catch(() => null);
    const userMessage = b?.message || 'Hello, I am interested in learning more.';

    const prompt = `${bot.persona ? `You are ${bot.persona}.` : 'You are a helpful assistant.'}

${bot.instructions || ''}

User: ${userMessage}

Respond naturally and helpfully. Keep response under 100 words.`;

    let response = `Thank you for your interest! ${bot.persona ? `I'm here to help.` : 'How can I assist you today?'}`;
    let latency_ms = 0;

    try {
      const start = Date.now();
      const aiRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      latency_ms = Date.now() - start;
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        response = aiData.response || response;
      }
    } catch { response = `[AI unavailable] ${response}`; }

    return Response.json({ bot_name: bot.name, user_message: userMessage, response, latency_ms, model: 'llama3.2' });
  } finally { client.release(); }
}
