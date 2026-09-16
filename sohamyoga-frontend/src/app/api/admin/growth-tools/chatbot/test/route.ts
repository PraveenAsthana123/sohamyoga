import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

interface ChatbotConfig {
  system_prompt: string | null;
  business_type: string | null;
  greeting_message: string;
  collect_name: boolean;
  collect_email: boolean;
  collect_phone: boolean;
  collect_appointment: boolean;
  appointment_link: string | null;
}

function buildSystemPrompt(config: ChatbotConfig): string {
  if (config.system_prompt) return config.system_prompt;
  const collect: string[] = [];
  if (config.collect_name) collect.push('name');
  if (config.collect_email) collect.push('email');
  if (config.collect_phone) collect.push('phone number');
  const collectStr = collect.length ? `Collect the visitor's ${collect.join(', ')}.` : '';
  const apptStr = config.collect_appointment && config.appointment_link
    ? `When appropriate, share the booking link: ${config.appointment_link}`
    : config.collect_appointment ? 'Help the visitor schedule an appointment.' : '';
  return `You are a friendly, professional assistant for a ${config.business_type || 'business'}. ${collectStr} ${apptStr} Keep responses concise (under 100 words). Be warm and helpful.`;
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body || !body.user_message) return Response.json({ error: 'user_message required' }, { status: 400 });

  const pool = getPool();

  let config: ChatbotConfig | null = null;
  if (body.config_id) {
    const { rows } = await pool.query(`SELECT * FROM chatbot_configs WHERE id=$1`, [body.config_id]);
    if (rows.length) config = rows[0] as ChatbotConfig;
  }
  if (!config) {
    const { rows } = await pool.query(`SELECT * FROM chatbot_configs WHERE is_active=true ORDER BY created_at LIMIT 1`);
    config = rows[0] as ChatbotConfig || null;
  }

  const systemPrompt = config
    ? buildSystemPrompt(config)
    : 'You are a helpful assistant. Be friendly and concise.';

  const fullPrompt = `${systemPrompt}\n\nUser: ${body.user_message}\n\nAssistant:`;

  let response = '';
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt: fullPrompt, stream: false }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) {
      const data = await res.json() as { response?: string };
      response = data.response?.trim() || '';
    }
  } catch { /* intentional */ }

  if (!response) {
    response = config?.greeting_message || "Thank you for reaching out! How can I help you today?";
  }

  const lower = body.user_message.toLowerCase();
  const shouldCollectEmail = Boolean(config?.collect_email) && (lower.includes('book') || lower.includes('class') || lower.includes('schedule') || lower.includes('trial') || lower.includes('free'));
  const shouldShowBookingLink = Boolean(config?.collect_appointment && config?.appointment_link) && (lower.includes('book') || lower.includes('schedule') || lower.includes('appointment'));

  return Response.json({ response, shouldCollectEmail, shouldShowBookingLink, bookingLink: config?.appointment_link || null });
}
