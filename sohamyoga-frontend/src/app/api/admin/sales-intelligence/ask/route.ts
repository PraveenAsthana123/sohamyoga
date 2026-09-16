export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const { question, context } = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    // RAG: search knowledge base for relevant articles
    const { rows: kb } = await client.query(
      `SELECT * FROM sales_knowledge_base WHERE title ILIKE $1 OR content ILIKE $1 ORDER BY usage_count DESC LIMIT 3`,
      [`%${question.split(' ').slice(0, 3).join('%')}%`]
    );

    const kbContext = kb.length > 0
      ? `Relevant knowledge base articles:\n${kb.map(a => `[${a.title}]: ${a.content}`).join('\n\n')}`
      : 'No specific articles found — answering from general sales knowledge.';

    const prompt = `You are an AI sales assistant for a yoga/wellness studio with a B2B corporate wellness product.

${kbContext}

Question: ${question}
Additional context: ${context || 'none'}

Provide a helpful, specific, actionable answer. Keep it under 200 words.`;

    let answer = '';
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json() as { response?: string };
      answer = data.response || '';
    } catch { /* fallback */ }

    if (!answer) {
      answer = kb.length > 0
        ? `Based on our knowledge base: ${kb[0].content.substring(0, 200)}...`
        : 'I found limited specific information on that topic. Please consult the knowledge base or reach out to your sales manager for guidance.';
    }

    // Save query
    const { rows: saved } = await client.query(
      `INSERT INTO sales_ai_queries (question, context, answer) VALUES ($1,$2,$3) RETURNING *`,
      [question, context || '', answer]
    );

    // Update KB usage counts
    if (kb.length > 0) {
      await client.query(`UPDATE sales_knowledge_base SET usage_count=usage_count+1 WHERE id=ANY($1)`, [kb.map(a => a.id)]);
    }

    return Response.json({
      answer,
      sources: kb.map(a => ({ title: a.title, category: a.category })),
      query_id: saved[0].id,
      ai_generated: true,
    });
  } finally { client.release(); }
}
