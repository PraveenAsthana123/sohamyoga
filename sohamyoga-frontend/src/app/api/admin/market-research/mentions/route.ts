export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

interface MentionRow {
  id: number;
  competitor_name: string;
  source: string | null;
  title: string | null;
  url: string | null;
  snippet: string | null;
  sentiment: string;
  mention_date: string | null;
  reach_estimate: number;
  reviewed: boolean;
  created_at: string;
}

interface OllamaResponse {
  response?: string;
}

async function callOllama(prompt: string): Promise<string> {
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
    signal: AbortSignal.timeout(60_000),
  });
  const data = (await res.json()) as OllamaResponse;
  return data.response ?? '';
}

// GET /api/admin/market-research/mentions?competitor=X&source=reddit&sentiment=positive
export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const competitor = searchParams.get('competitor');
  const source = searchParams.get('source');
  const sentiment = searchParams.get('sentiment');

  const conditions: string[] = [];
  const params: string[] = [];

  if (competitor) {
    params.push(competitor);
    conditions.push(`competitor_name = $${params.length}`);
  }
  if (source && source !== 'all') {
    params.push(source);
    conditions.push(`source = $${params.length}`);
  }
  if (sentiment && sentiment !== 'all') {
    params.push(sentiment);
    conditions.push(`sentiment = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query<MentionRow>(
    `SELECT * FROM competitor_mention ${where} ORDER BY mention_date DESC, created_at DESC LIMIT 200`,
    params,
  );

  const rows = result.rows;
  const kpis = {
    total: rows.length,
    positive: rows.filter(r => r.sentiment === 'positive').length,
    neutral: rows.filter(r => r.sentiment === 'neutral').length,
    negative: rows.filter(r => r.sentiment === 'negative').length,
    unreviewed: rows.filter(r => !r.reviewed).length,
    competitors: [...new Set(rows.map(r => r.competitor_name))].length,
  };

  return NextResponse.json({ mentions: rows, kpis });
}

// POST /api/admin/market-research/mentions
// body: { action: 'review'; id: number } | ?action=scan (Ollama sentiment)
export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'scan') {
    // Fetch all unreviewed mentions and score sentiment via Ollama
    const unreviewed = await pool.query<MentionRow>(
      `SELECT * FROM competitor_mention WHERE reviewed = false ORDER BY created_at DESC LIMIT 50`,
    );

    if (unreviewed.rowCount === 0) {
      return NextResponse.json({ ok: true, message: 'No unreviewed mentions to scan.', scored: 0 });
    }

    let scored = 0;
    for (const mention of unreviewed.rows) {
      try {
        const text = [mention.title, mention.snippet].filter(Boolean).join(' — ');
        const prompt = `Classify the sentiment of this competitor mention as exactly one word: positive, neutral, or negative.
Mention: "${text}"
Respond with only the single word sentiment label, nothing else.`;

        const raw = await callOllama(prompt);
        const sentimentRaw = raw.trim().toLowerCase().split(/\s+/)[0] ?? 'neutral';
        const sentiment = ['positive', 'negative', 'neutral'].includes(sentimentRaw)
          ? sentimentRaw
          : 'neutral';

        await pool.query(
          'UPDATE competitor_mention SET sentiment = $1 WHERE id = $2',
          [sentiment, mention.id],
        );
        scored++;
      } catch {
        // skip individual failures, continue processing
      }
    }

    return NextResponse.json({ ok: true, message: `Ollama scored sentiment for ${scored} mentions.`, scored });
  }

  // Default: mark as reviewed
  const body = (await req.json()) as { action?: string; id?: number };
  const { id } = body;

  if (typeof id !== 'number') {
    return NextResponse.json({ error: 'id (number) required' }, { status: 400 });
  }

  await pool.query(
    'UPDATE competitor_mention SET reviewed = true WHERE id = $1',
    [id],
  );

  return NextResponse.json({ ok: true });
}

// PATCH /api/admin/market-research/mentions
// body: { id: number; reviewed: boolean } — mark a mention as reviewed/unreviewed
export async function PATCH(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const body = (await req.json()) as { id?: number; reviewed?: boolean };
  const { id, reviewed } = body;

  if (typeof id !== 'number') {
    return NextResponse.json({ error: 'id (number) required' }, { status: 400 });
  }

  const reviewedValue = reviewed !== false; // default to true if not specified

  await pool.query(
    'UPDATE competitor_mention SET reviewed = $1 WHERE id = $2',
    [reviewedValue, id],
  );

  return NextResponse.json({ ok: true });
}
