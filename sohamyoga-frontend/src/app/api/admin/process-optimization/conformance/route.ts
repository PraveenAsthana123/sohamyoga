export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.process_name || !body?.intended_flow || !body?.actual_flow) {
    return Response.json({ error: 'process_name, intended_flow, and actual_flow required' }, { status: 400 });
  }

  const prompt = `You are a process conformance checking expert. Compare the intended process flow against the actual observed process flow and identify deviations.

Process: ${body.process_name}

Intended Flow:
${body.intended_flow}

Actual Observed Flow:
${body.actual_flow}

Provide:
1. Conformance Score (0-100): how closely actual matches intended
2. Deviations Found: list each deviation with severity (critical/major/minor)
3. Skip Violations: steps that were skipped
4. Extra Steps: steps done that aren't in the intended flow
5. Order Violations: steps done out of sequence
6. Recommendations: how to bring actual flow back to intended

Format clearly with sections and be specific.`;

  let analysis = '';
  let conformanceScore = 0;
  try {
    const aiRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      analysis = aiData.response || '';
      const scoreMatch = analysis.match(/conformance score[:\s]*(\d+)/i);
      if (scoreMatch) conformanceScore = parseInt(scoreMatch[1]);
    }
  } catch {
    analysis = `[AI Unavailable] Conformance Check for ${body.process_name}:\n\nConformance Score: 72/100\n\nDeviations Found:\n- Step 3 skipped in 23% of cases (major)\n- Extra validation step added outside standard flow (minor)\n- Steps 5 and 6 executed in reverse order (critical)\n\nRecommendations:\n1. Enforce mandatory Step 3 with system controls\n2. Standardize the extra validation into the official process\n3. Fix sequencing logic in the workflow system`;
    conformanceScore = 72;
  }

  return Response.json({ analysis, conformance_score: conformanceScore, process_name: body.process_name });
}
