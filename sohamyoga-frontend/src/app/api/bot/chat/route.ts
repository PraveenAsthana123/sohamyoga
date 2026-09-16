import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = (process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';

const SYSTEM_PROMPT = `You are SohamBot, the intelligent customer service assistant for the Sohamyoga digital marketing platform.

You have knowledge about:

BILLING & PRICING:
- Subscription plans: Starter ($49/mo), Growth ($149/mo), Enterprise ($499/mo)
- Features per plan: Starter=5 platforms, Growth=20 platforms, Enterprise=all 36 platforms
- Billing cycle: monthly or annual (20% discount annual)
- Payment methods: credit card, bank transfer
- Refund policy: 30-day money-back guarantee
- Upgrade/downgrade: immediate with prorated billing

FEATURES:
- 36 social media platforms integrated (Facebook, Instagram, Twitter, LinkedIn, YouTube, TikTok, WhatsApp Business, Pinterest, Reddit, Discord, and 26 more)
- AI content generation via Ollama (local, private — your data never leaves the server)
- Workflow automation: 8 trigger types, 8 action types
- Platform monitoring: health checks every 5 minutes, rate limit tracking
- Affiliate management: 4 tiers (Bronze 5%, Silver 8%, Gold 10%, Platinum 15%)
- Market research: competitor analysis, AI-generated reports
- Module intelligence: 221 modules tracked with test coverage

OPERATIONS:
- Platform runs on Next.js 14 with PostgreSQL
- 104 automated cron jobs running continuously
- API catalog: 185+ tracked API endpoints across platforms
- Uptime: monitored every 5 minutes
- Data backup: daily
- Support: admin@sohamyoga.com, 9am-6pm IST

TROUBLESHOOTING:
- Platform not posting: check /admin/platform-credentials, verify env vars set
- Workflow not triggering: check /admin/platform-workflows, verify trigger type matches
- Analytics not showing: check /admin/platform-monitoring, may be rate-limited
- Affiliate links not tracking: verify /r/{code} route is working

Always be helpful, concise, and professional. If you don't know the answer, offer to escalate to a human agent.
When the user asks about billing, always confirm their current plan before making recommendations.
Use emojis sparingly for friendliness.`;

const ESCALATION_KEYWORDS = ['cancel', 'refund', 'urgent', 'fraud', 'charged twice', 'double charge', 'sue', 'lawyer', 'dispute', 'chargeback'];

function detectIntent(message: string): { intent: string; confidence: number } {
  const lower = message.toLowerCase();
  if (/billing|invoice|charge|payment|plan|subscription|refund|price|cost|upgrade|downgrade/.test(lower)) {
    return { intent: 'billing_query', confidence: 0.85 };
  }
  if (/feature|how to|how do|connect|integrate|post|publish|workflow|automation|platform/.test(lower)) {
    return { intent: 'feature_query', confidence: 0.82 };
  }
  if (/down|status|error|broken|not working|slow|crash|bug|issue/.test(lower)) {
    return { intent: 'ops_query', confidence: 0.80 };
  }
  if (/complain|unhappy|terrible|awful|worst|angry|frustrated|cancel|refund/.test(lower)) {
    return { intent: 'complaint', confidence: 0.78 };
  }
  return { intent: 'general', confidence: 0.60 };
}

async function callOllama(messages: Array<{ role: string; content: string }>): Promise<{ text: string; tokens: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: { temperature: 0.5, num_predict: 512 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const data = (await res.json()) as {
      message?: { content?: string };
      eval_count?: number;
    };
    return {
      text: data.message?.content?.trim() ?? "I'm sorry, I couldn't generate a response right now.",
      tokens: data.eval_count ?? 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const body = (await req.json()) as {
      session_token: string;
      message: string;
      context_type?: string;
    };

    if (!body.session_token || !body.message?.trim()) {
      return NextResponse.json({ error: 'session_token and message are required' }, { status: 400 });
    }

    // Resolve session
    const { rows: sessions } = await pool.query<{ id: number; context_type: string | null }>(
      `SELECT id, context_type FROM bot_session WHERE session_token = $1 AND resolved = false`,
      [body.session_token],
    );
    if (!sessions.length) {
      return NextResponse.json({ error: 'Session not found or already resolved' }, { status: 404 });
    }
    const session = sessions[0];

    // Fetch recent conversation history (last 10 messages)
    const { rows: history } = await pool.query<{ role: string; content: string }>(
      `SELECT role, content FROM bot_message WHERE session_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [session.id],
    );

    const contextType = body.context_type ?? session.context_type ?? 'general';

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.reverse(),
      { role: 'user', content: body.message.trim() },
    ];

    // Detect intent
    const { intent, confidence } = detectIntent(body.message);

    // Check for immediate escalation keywords
    const needsEscalation = ESCALATION_KEYWORDS.some(kw => body.message.toLowerCase().includes(kw));

    // Call Ollama
    let replyText: string;
    let tokensUsed: number;
    try {
      const result = await callOllama(messages);
      replyText = result.text;
      tokensUsed = result.tokens;
    } catch {
      replyText = "I'm having trouble connecting to my AI service right now. Please try again in a moment, or type 'escalate' to reach a human agent.";
      tokensUsed = 0;
    }

    const responseTimeMs = Date.now() - started;

    // Store user message
    await pool.query(
      `INSERT INTO bot_message (session_id, role, content, intent_detected, confidence, response_time_ms)
       VALUES ($1, 'user', $2, $3, $4, $5)`,
      [session.id, body.message.trim(), intent, confidence, responseTimeMs],
    );

    // Store assistant reply
    await pool.query(
      `INSERT INTO bot_message (session_id, role, content, intent_detected, confidence, response_time_ms, tokens_used)
       VALUES ($1, 'assistant', $2, $3, $4, $5, $6)`,
      [session.id, replyText, intent, confidence, responseTimeMs, tokensUsed],
    );

    // Update session stats
    await pool.query(
      `UPDATE bot_session
       SET message_count = message_count + 2,
           last_message_at = NOW(),
           context_type = $1
       WHERE id = $2`,
      [contextType, session.id],
    );

    // Update knowledge base usage count if intent matches a known entry
    if (intent !== 'general') {
      const category = intent.replace('_query', '').replace('complaint', 'faq');
      await pool.query(
        `UPDATE bot_knowledge_base SET usage_count = usage_count + 1
         WHERE category = $1 AND is_active = true LIMIT 1`,
        [category],
      ).catch(() => {});
    }

    return NextResponse.json({
      reply: replyText,
      intent,
      confidence,
      session_id: session.id,
      response_time_ms: responseTimeMs,
      needs_escalation: needsEscalation,
    });
  } catch (e) {
    console.error('[bot/chat]', e);
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}
