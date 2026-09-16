import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatbot_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      business_type TEXT,
      greeting_message TEXT DEFAULT 'Hi! How can I help you today?',
      fallback_message TEXT DEFAULT 'I''ll connect you with our team shortly.',
      collect_name BOOLEAN DEFAULT true,
      collect_email BOOLEAN DEFAULT true,
      collect_phone BOOLEAN DEFAULT false,
      collect_appointment BOOLEAN DEFAULT true,
      appointment_link TEXT,
      ai_model TEXT DEFAULT 'ollama_llama3.2',
      system_prompt TEXT,
      is_active BOOLEAN DEFAULT true,
      embed_code TEXT,
      widget_color TEXT DEFAULT '#3B82F6',
      widget_position TEXT DEFAULT 'bottom_right',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS appointment_reminders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      appointment_type TEXT,
      appointment_at TIMESTAMPTZ NOT NULL,
      location TEXT,
      meeting_url TEXT,
      reminder_sent_24h BOOLEAN DEFAULT false,
      reminder_sent_1h BOOLEAN DEFAULT false,
      confirmation_sent BOOLEAN DEFAULT false,
      cancellation_sent BOOLEAN DEFAULT false,
      status TEXT DEFAULT 'confirmed',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  const { rowCount } = await pool.query(`SELECT 1 FROM chatbot_configs LIMIT 1`);
  if (!rowCount) {
    await pool.query(`
      INSERT INTO chatbot_configs
        (name, business_type, greeting_message, fallback_message,
         collect_name, collect_email, collect_phone, collect_appointment,
         appointment_link, ai_model, system_prompt, is_active, widget_color, widget_position,
         embed_code)
      VALUES
        ('Soham Yoga Main Bot', 'yoga studio',
         'Namaste! 🧘 Welcome to Soham Yoga. How can I help you today?',
         'Our team will follow up with you shortly. Thank you!',
         true, true, false, true,
         'https://cal.com/sohamyoga', 'ollama_llama3.2',
         'You are a friendly assistant for Soham Yoga Studio. Help visitors book classes, answer FAQs about yoga styles, and collect their contact information. Always be warm, professional, and encouraging.',
         true, '#3B82F6', 'bottom_right',
         '<script src="https://sohamyoga.ca/chatbot.js" data-bot-id="soham-main"></script>'),
        ('Lead Gen Bot – Free Trial', 'yoga studio',
         'Hi there! Interested in a FREE trial yoga class? 🎉',
         'We will reach out within 24 hours to schedule your free class!',
         true, true, true, false,
         NULL, 'ollama_llama3.2',
         'You are a lead generation assistant for Soham Yoga. Your goal is to get visitors to sign up for a free trial class. Highlight benefits, address objections, and collect name, email and phone.',
         true, '#10B981', 'bottom_left',
         '<script src="https://sohamyoga.ca/chatbot.js" data-bot-id="soham-lead"></script>');
    `);
    await pool.query(`
      INSERT INTO appointment_reminders
        (customer_name, customer_email, customer_phone, appointment_type,
         appointment_at, location, meeting_url, status,
         reminder_sent_24h, reminder_sent_1h, confirmation_sent)
      VALUES
        ('Sarah Chen', 'sarah.chen@email.com', '+14165550101', 'Private Yoga Session',
         NOW() + INTERVAL '26 hours', 'Downtown Studio', NULL, 'confirmed', false, false, true),
        ('Michael Torres', 'michael.t@email.com', '+14165550102', 'Group Hatha Class',
         NOW() + INTERVAL '2 hours', 'North York Studio', NULL, 'confirmed', true, false, true),
        ('Priya Sharma', 'priya.s@email.com', '+14165550103', 'Meditation Workshop',
         NOW() + INTERVAL '72 hours', 'Downtown Studio', 'https://meet.google.com/xyz', 'confirmed', false, false, true),
        ('James Liu', 'james.l@email.com', '+14165550104', 'Prenatal Yoga',
         NOW() + INTERVAL '4 days', 'Downtown Studio', NULL, 'confirmed', false, false, true),
        ('Emma Wilson', 'emma.w@email.com', '+14165550105', 'Private Yoga Session',
         NOW() - INTERVAL '3 days', 'North York Studio', NULL, 'completed', true, true, true),
        ('David Kim', 'david.k@email.com', '+14165550106', 'Group Vinyasa',
         NOW() - INTERVAL '7 days', 'Downtown Studio', NULL, 'completed', true, true, true),
        ('Lisa Brown', 'lisa.b@email.com', '+14165550107', 'Restorative Yoga',
         NOW() - INTERVAL '1 day', 'North York Studio', NULL, 'no_show', true, true, true),
        ('Ryan Patel', 'ryan.p@email.com', '+14165550108', 'Yin Yoga Class',
         NOW() + INTERVAL '5 days', 'Downtown Studio', NULL, 'rescheduled', false, false, false);
    `);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  await ensureSchema(pool);
  const [configs, stats] = await Promise.all([
    pool.query(`SELECT * FROM chatbot_configs ORDER BY created_at`),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='confirmed') AS confirmed,
        COUNT(*) FILTER (WHERE status='completed') AS completed,
        COUNT(*) FILTER (WHERE status='cancelled') AS cancelled,
        COUNT(*) FILTER (WHERE status='no_show') AS no_show,
        COUNT(*) FILTER (WHERE status='rescheduled') AS rescheduled,
        COUNT(*) FILTER (WHERE appointment_at > NOW()) AS upcoming,
        COUNT(*) AS total
      FROM appointment_reminders
    `),
  ]);
  return Response.json({ configs: configs.rows, stats: stats.rows[0] });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body || !body.name) return Response.json({ error: 'name required' }, { status: 400 });
  const pool = getPool();
  await ensureSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO chatbot_configs
      (name, business_type, greeting_message, fallback_message,
       collect_name, collect_email, collect_phone, collect_appointment,
       appointment_link, ai_model, system_prompt, widget_color, widget_position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      body.name, body.business_type || null,
      body.greeting_message || 'Hi! How can I help you today?',
      body.fallback_message || "I'll connect you with our team shortly.",
      body.collect_name !== false, body.collect_email !== false,
      body.collect_phone === true, body.collect_appointment !== false,
      body.appointment_link || null, body.ai_model || 'ollama_llama3.2',
      body.system_prompt || null,
      body.widget_color || '#3B82F6', body.widget_position || 'bottom_right',
    ],
  );
  return Response.json({ config: rows[0] }, { status: 201 });
}
