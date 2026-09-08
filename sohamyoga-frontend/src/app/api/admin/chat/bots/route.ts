import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const bots = await query<{
    id: string; name: string; bot_type: string; status: string; model: string | null;
    max_turns: number; temperature: string; handoff_triggers: string[];
  }>(`SELECT id, name, bot_type::text, status::text, model, max_turns, temperature::text, handoff_triggers FROM chat_bot ORDER BY name`);

  return Response.json({
    bots: bots.rows.map((b) => ({
      id: b.id, name: b.name, type: b.bot_type, status: b.status, model: b.model,
      maxTurns: b.max_turns, temperature: Number(b.temperature), handoffTriggers: b.handoff_triggers,
    })),
  });
}
