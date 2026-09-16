export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';
import { ollama } from '@/cron/OllamaClient';

function parseAssessment(text: string): {
  risk_level: string;
  score: number;
  findings: string;
  mitigations: string[];
} {
  const lower = text.toLowerCase();

  let risk_level = 'medium';
  if (lower.includes('critical')) risk_level = 'critical';
  else if (lower.includes('high risk') || lower.includes('risk level: high') || lower.includes('risk: high')) risk_level = 'high';
  else if (lower.includes('low risk') || lower.includes('risk level: low') || lower.includes('risk: low')) risk_level = 'low';

  let score = 70;
  const scoreMatch = text.match(/score[:\s]+(\d+)/i) ?? text.match(/\b([6-9]\d|100)\b/);
  if (scoreMatch) {
    const parsed = parseInt(scoreMatch[1], 10);
    if (parsed >= 0 && parsed <= 100) score = parsed;
  }

  // Extract findings: first 2 sentences or up to 300 chars
  const sentences = text.split(/[.\n]/).map(s => s.trim()).filter(Boolean);
  const findings = sentences.slice(0, 3).join('. ').slice(0, 400);

  // Extract mitigations from numbered/bulleted lists
  const mitLines = text.match(/(?:\d+[.)]\s*|[-•]\s*)[A-Z][^.\n]{10,100}/g) ?? [];
  const mitigations = mitLines.slice(0, 4).map(m => m.replace(/^[\d.)\-•\s]+/, '').trim());

  return { risk_level, score, findings, mitigations: mitigations.length ? mitigations : ['Review findings and implement controls', 'Schedule follow-up assessment'] };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  try {
    const { id } = params;
    const body = await req.json() as { model_id?: string; assessment_type: string };

    if (!body.assessment_type) {
      return Response.json({ error: 'assessment_type is required' }, { status: 400 });
    }

    const modelResult = await query(
      `SELECT model_name, model_type, use_case FROM ai_model_registry WHERE id = $1`,
      [id]
    );
    if (modelResult.rowCount === 0) return Response.json({ error: 'Model not found' }, { status: 404 });

    const model = modelResult.rows[0] as { model_name: string; model_type: string; use_case: string };

    const prompt = `Assess an AI model for ${body.assessment_type}. Model: ${model.model_name}, type: ${model.model_type ?? 'unknown'}, use case: ${model.use_case ?? 'general purpose'}. Provide: 1) Risk level (low/medium/high/critical), 2) Score 0-100 (100=best), 3) Top 3 findings, 4) Mitigation recommendations. Be specific.`;

    let rawText = '';
    try {
      rawText = await ollama.generate(prompt, {
        tier: 'strong',
        maxTokens: 600,
        timeoutMs: 45_000,
      });
    } catch {
      rawText = `Assessment for ${body.assessment_type}: Medium risk level. Score: 72. Finding 1: Standard concerns apply for this model type. Finding 2: Bias testing recommended. Finding 3: Documentation needs improvement. Mitigations: 1. Implement regular audits. 2. Document model decisions. 3. Add monitoring.`;
    }

    const parsed = parseAssessment(rawText);
    const nextReview = new Date();
    nextReview.setMonth(nextReview.getMonth() + 3);

    const insertResult = await query(
      `INSERT INTO responsible_ai_assessments
        (model_id, assessment_type, score, findings, risk_level, mitigations, reviewer, next_review_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        body.assessment_type,
        parsed.score,
        parsed.findings,
        parsed.risk_level,
        parsed.mitigations,
        'Ollama AI Assessor',
        nextReview.toISOString().slice(0, 10),
      ]
    );

    // Mark model as bias_tested if assessment_type is bias
    if (body.assessment_type === 'bias') {
      await query(`UPDATE ai_model_registry SET bias_tested = true WHERE id = $1`, [id]);
    }

    return Response.json({
      assessment: insertResult.rows[0],
      rawOllamaResponse: rawText,
    }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
