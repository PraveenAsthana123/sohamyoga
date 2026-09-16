export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { prompt } = body;
  if (!prompt) return Response.json({ error: 'prompt required' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: guardrails } = await client.query(`SELECT * FROM ai_guardrails WHERE enabled=true`);
    const triggered: object[] = [];
    const passed: object[] = [];

    for (const g of guardrails) {
      try {
        const regex = new RegExp(g.pattern, 'i');
        const hit = regex.test(prompt);
        if (hit) {
          triggered.push({ id: g.id, name: g.name, rule_type: g.rule_type, action: g.action });
          await client.query(`UPDATE ai_guardrails SET triggered_count=triggered_count+1 WHERE id=$1`, [g.id]);
        } else {
          passed.push({ id: g.id, name: g.name });
        }
      } catch {
        passed.push({ id: g.id, name: g.name, note: 'pattern error' });
      }
    }

    return Response.json({
      prompt,
      triggered,
      passed,
      verdict: triggered.length > 0 ? 'blocked' : 'allowed',
      triggered_count: triggered.length,
      passed_count: passed.length,
    });
  } finally {
    client.release();
  }
}
