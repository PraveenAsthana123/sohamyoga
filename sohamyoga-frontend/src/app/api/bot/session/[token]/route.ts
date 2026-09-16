import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const { rows: sessions } = await pool.query(
      `SELECT * FROM bot_session WHERE session_token = $1`,
      [params.token],
    );
    if (!sessions.length) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    const session = sessions[0] as { id: number };
    const { rows: messages } = await pool.query(
      `SELECT * FROM bot_message WHERE session_id = $1 ORDER BY created_at ASC`,
      [session.id],
    );
    return NextResponse.json({ session, messages });
  } catch (e) {
    console.error('[bot/session/token GET]', e);
    return NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
  }
}
