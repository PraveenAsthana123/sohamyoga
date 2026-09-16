import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { room_name, theme, difficulty, group_type, player_count } = body;

  const prompt = `Write a game master introduction script for an escape room: ${room_name} with theme: ${theme}, difficulty: ${difficulty}. Group type: ${group_type}, ${player_count} players. Include: atmospheric intro, safety rules (in theme), hint system explanation, motivational send-off. Engaging, theatrical tone. 2-3 minutes spoken. Calgary entertainment context.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json() as { response: string };
    return Response.json({ script: data.response });
  } catch {
    return Response.json({
      script: `[GAME MASTER SCRIPT — ${room_name}]\n\n*dim the lights, step forward dramatically*\n\nWelcome, brave souls, to ${room_name}. You've entered a world where ${theme} holds its darkest secrets...\n\nBefore you begin your adventure — a few rules. First: in case of an emergency, the EXIT signs are NOT part of the puzzle. Second: please don't dismantle anything bolted to the wall. Third: if something looks broken, it's probably part of the experience.\n\nYou will have ${difficulty === 'extreme' ? '60' : '60'} minutes. Should you find yourselves completely stumped, you may request up to 3 hints by raising your hand or pressing the red button. Use them wisely.\n\nYou are ${player_count} brave adventurers. Calgary has seen many attempt this room — only the sharpest minds have prevailed.\n\nYour time begins... NOW. Good luck!\n\nNote: AI service unavailable — fallback template used.`,
    });
  }
}
