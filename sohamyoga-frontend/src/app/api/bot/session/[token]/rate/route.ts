import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const body = (await req.json()) as { score: number };
    const score = Math.min(5, Math.max(1, Math.round(body.score)));
    const { rowCount } = await pool.query(
      `UPDATE bot_session SET satisfaction_score = $1, resolved = true WHERE session_token = $2`,
      [score, params.token],
    );
    if (!rowCount) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    return NextResponse.json({ ok: true, score });
  } catch (e) {
    console.error('[bot/session/rate]', e);
    return NextResponse.json({ error: 'Failed to rate session' }, { status: 500 });
  }
}
