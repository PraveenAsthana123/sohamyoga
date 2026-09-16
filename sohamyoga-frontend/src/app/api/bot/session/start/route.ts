import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_session (
      id SERIAL PRIMARY KEY,
      session_token VARCHAR(100) UNIQUE NOT NULL,
      user_type VARCHAR(20),
      user_id INT,
      user_email VARCHAR(200),
      context_type VARCHAR(30),
      started_at TIMESTAMPTZ DEFAULT NOW(),
      last_message_at TIMESTAMPTZ,
      message_count INT DEFAULT 0,
      resolved BOOLEAN DEFAULT false,
      escalated_to_human BOOLEAN DEFAULT false,
      satisfaction_score INT
    );
    CREATE TABLE IF NOT EXISTS bot_message (
      id SERIAL PRIMARY KEY,
      session_id INT REFERENCES bot_session(id) ON DELETE CASCADE,
      role VARCHAR(10) NOT NULL,
      content TEXT NOT NULL,
      intent_detected VARCHAR(50),
      confidence DECIMAL(3,2),
      response_time_ms INT,
      tokens_used INT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bot_knowledge_base (
      id SERIAL PRIMARY KEY,
      category VARCHAR(50),
      question VARCHAR(500),
      answer TEXT,
      keywords TEXT,
      is_active BOOLEAN DEFAULT true,
      usage_count INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS service_ticket (
      id SERIAL PRIMARY KEY,
      session_id INT,
      customer_email VARCHAR(200),
      customer_name VARCHAR(200),
      subject VARCHAR(300),
      description TEXT,
      category VARCHAR(30),
      priority VARCHAR(20) DEFAULT 'medium',
      status VARCHAR(20) DEFAULT 'open',
      assigned_agent VARCHAR(100),
      resolution_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    );
  `);
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = (await req.json().catch(() => ({}))) as {
      user_type?: string;
      user_id?: number;
      user_email?: string;
      context_type?: string;
    };

    const token = randomBytes(32).toString('hex');
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO bot_session (session_token, user_type, user_id, user_email, context_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [token, body.user_type ?? 'anonymous', body.user_id ?? null, body.user_email ?? null, body.context_type ?? 'general'],
    );

    return Response.json({ session_token: token, session_id: rows[0].id });
  } catch (e) {
    console.error('[bot/session/start]', e);
    return Response.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
