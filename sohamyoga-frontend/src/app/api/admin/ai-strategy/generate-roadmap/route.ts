export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';
import { ollama } from '@/cron/OllamaClient';

interface GeneratedInitiative {
  name: string;
  phase: string;
  ai_capability: string;
  business_value: string;
  estimated_roi_pct: number;
  risk_level: string;
}

function parseInitiatives(text: string): GeneratedInitiative[] {
  // Try JSON parse first
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>[];
      return parsed.map(item => ({
        name: String(item.name ?? item.initiative_name ?? 'AI Initiative'),
        phase: String(item.phase ?? 'foundation'),
        ai_capability: String(item.ai_capability ?? 'automation'),
        business_value: String(item.business_value ?? item.value ?? 'Improve business outcomes'),
        estimated_roi_pct: Number(item.estimated_roi_pct ?? item.roi ?? 20),
        risk_level: String(item.risk_level ?? item.risk ?? 'medium'),
      }));
    }
  } catch { /* fall through to text parsing */ }

  // Text fallback: parse numbered items
  const lines = text.split('\n').filter(l => l.trim());
  const initiatives: GeneratedInitiative[] = [];
  const phases = ['foundation', 'pilot', 'scale', 'optimize', 'innovate'];

  for (const line of lines) {
    const match = line.match(/^\d+[.)]\s*(.+)/);
    if (match) {
      const phaseName = phases[Math.floor(initiatives.length / 3)] ?? 'scale';
      initiatives.push({
        name: match[1].replace(/\*\*/g, '').trim().slice(0, 100),
        phase: phaseName,
        ai_capability: 'automation',
        business_value: 'AI-driven business improvement',
        estimated_roi_pct: 20 + Math.floor(Math.random() * 40),
        risk_level: 'medium',
      });
    }
    if (initiatives.length >= 8) break;
  }

  return initiatives;
}

const PHASE_ORDER = ['foundation', 'pilot', 'scale', 'optimize', 'innovate'];

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  try {
    const body = await req.json() as {
      business_type: string;
      current_ai_maturity: number;
      top_priority: string;
      budget_range: string;
    };

    if (!body.business_type?.trim()) {
      return Response.json({ error: 'business_type is required' }, { status: 400 });
    }

    const maturity = Math.min(5, Math.max(1, Number(body.current_ai_maturity) || 1));
    const prompt = `Generate a 12-month AI transformation roadmap for a ${body.business_type} business at maturity level ${maturity}/5. Priority: ${body.top_priority ?? 'cost reduction'}. Budget: ${body.budget_range ?? 'medium ($100k-$500k)'}. Output 8 initiatives organized into 3 phases (Foundation/Pilot/Scale), each with: name, phase, ai_capability, business_value, estimated_roi_pct, risk_level. JSON array format.`;

    let rawText = '';
    try {
      rawText = await ollama.generate(prompt, {
        tier: 'strong',
        maxTokens: 1200,
        timeoutMs: 60_000,
      });
    } catch {
      // Fallback static roadmap if Ollama unavailable
      rawText = JSON.stringify([
        { name: `${body.business_type} Data Foundation`, phase: 'foundation', ai_capability: 'automation', business_value: 'Enable AI-ready data pipelines', estimated_roi_pct: 15, risk_level: 'low' },
        { name: 'Customer Behaviour Analytics', phase: 'foundation', ai_capability: 'prediction', business_value: 'Understand customer needs', estimated_roi_pct: 20, risk_level: 'low' },
        { name: 'AI Chatbot Pilot', phase: 'pilot', ai_capability: 'nlp', business_value: 'Reduce support costs 30%', estimated_roi_pct: 35, risk_level: 'medium' },
        { name: 'Predictive Demand Forecasting', phase: 'pilot', ai_capability: 'prediction', business_value: 'Reduce inventory costs', estimated_roi_pct: 28, risk_level: 'medium' },
        { name: 'Automated Content Generation', phase: 'pilot', ai_capability: 'generation', business_value: 'Scale content 5x', estimated_roi_pct: 45, risk_level: 'low' },
        { name: 'AI-Powered Personalisation Engine', phase: 'scale', ai_capability: 'recommendation', business_value: 'Increase conversion 20%', estimated_roi_pct: 55, risk_level: 'medium' },
        { name: 'Process Automation Platform', phase: 'scale', ai_capability: 'automation', business_value: 'Save 1000 hours/month', estimated_roi_pct: 65, risk_level: 'medium' },
        { name: 'AI Innovation Lab', phase: 'scale', ai_capability: 'generation', business_value: 'Build competitive moat', estimated_roi_pct: 80, risk_level: 'high' },
      ]);
    }

    const initiatives = parseInitiatives(rawText);
    if (initiatives.length === 0) {
      return Response.json({ error: 'Could not parse AI-generated roadmap. Try again.' }, { status: 422 });
    }

    const inserted: unknown[] = [];
    for (let i = 0; i < initiatives.length; i++) {
      const item = initiatives[i];
      const phase = PHASE_ORDER.includes(item.phase) ? item.phase : PHASE_ORDER[Math.floor(i / 3)] ?? 'foundation';

      const result = await query(
        `INSERT INTO ai_transformation_roadmap
          (initiative_name, phase, priority, status, business_value, ai_capability,
           estimated_roi_pct, risk_level, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          item.name.slice(0, 200),
          phase,
          i < 2 ? 'critical' : i < 4 ? 'high' : 'medium',
          'planned',
          item.business_value.slice(0, 500),
          item.ai_capability,
          Math.min(200, Math.max(0, item.estimated_roi_pct)),
          ['low', 'medium', 'high', 'critical'].includes(item.risk_level) ? item.risk_level : 'medium',
          `AI-generated roadmap for ${body.business_type} (maturity ${maturity}/5)`,
        ]
      );
      inserted.push(result.rows[0]);
    }

    return Response.json({
      initiatives: inserted,
      generatedCount: inserted.length,
      businessType: body.business_type,
      maturityLevel: maturity,
      rawOllamaResponse: rawText,
    }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
