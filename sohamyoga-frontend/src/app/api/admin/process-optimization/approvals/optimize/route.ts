export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const bottlenecks = await client.query('SELECT * FROM approval_bottlenecks ORDER BY avg_wait_hours DESC LIMIT 10');
    const body = await req.json().catch(() => ({}));
    const context = body?.context || '';

    const bottleneckSummary = bottlenecks.rows.map(b =>
      `- ${b.process_name} / ${b.step_name}: ${b.avg_wait_hours}h avg wait, Approver: ${b.approver || 'Unknown'}, Bypass eligible: ${b.bypass_eligible}`
    ).join('\n');

    const prompt = `You are a process optimization expert specializing in approval chain efficiency.

Current Approval Bottlenecks:
${bottleneckSummary}
${context ? `\nAdditional Context: ${context}` : ''}

Provide specific recommendations to:
1. Reduce wait times (delegate, parallelize, auto-approve where safe)
2. Identify which approvals can be eliminated or combined
3. Suggest threshold-based routing (e.g., auto-approve under $X)
4. Recommend SLA targets for each bottleneck
5. Technology solutions (workflow tools, notifications, escalation)

Format with clear sections and prioritize by potential impact.`;

    let recommendations = '';
    try {
      const aiRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        recommendations = aiData.response || '';
      }
    } catch {
      recommendations = `[AI Unavailable] Approval Optimization Recommendations:\n1. Delegate routine approvals under $5K to department heads\n2. Set 24-hour SLA with automatic escalation\n3. Implement parallel approval routing where steps are independent\n4. Create pre-approved templates for common request types\n5. Use workflow automation to send reminders every 4 hours`;
    }
    return Response.json({ recommendations, bottlenecks: bottlenecks.rows });
  } finally { client.release(); }
}
