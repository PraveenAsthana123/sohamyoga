export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { business_description } = body;
  if (!business_description) return Response.json({ error: 'business_description required' }, { status: 400 });

  const prompt = `You are an AI opportunity discovery specialist. Scan this business description and identify the top 5 AI automation opportunities:

Business: ${business_description}

For each opportunity provide:
- title: short name
- department: which team benefits
- current_process: the manual/inefficient step today
- ai_solution: specific AI approach (name the model type)
- effort: low/medium/high (to implement)
- impact: low/medium/high (business value)
- roi_estimate_hours_saved_monthly: number

Respond as JSON array of 5 objects with those keys.`;

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await ollamaRes.json();
    const text = data.response ?? '';
    const match = text.match(/\[[\s\S]*\]/);
    const opportunities = match ? JSON.parse(match[0]) : [];
    return Response.json({ business_description, opportunities, raw: text });
  } catch {
    return Response.json({
      business_description,
      opportunities: [
        { title: 'Automated Customer Email Responses', department: 'Support', current_process: 'Manual email replies taking 15min each', ai_solution: 'LLM-generated draft responses for agent review', effort: 'low', impact: 'high', roi_estimate_hours_saved_monthly: 40 },
        { title: 'Content Generation at Scale', department: 'Marketing', current_process: 'Copywriter produces 5 posts/week', ai_solution: 'Ollama llama3.2 generates 50+ posts for human selection', effort: 'low', impact: 'high', roi_estimate_hours_saved_monthly: 30 },
        { title: 'Invoice Processing Automation', department: 'Finance', current_process: 'Manual invoice data entry', ai_solution: 'OCR + LLM extraction pipeline', effort: 'medium', impact: 'medium', roi_estimate_hours_saved_monthly: 12 },
        { title: 'Lead Scoring Model', department: 'Sales', current_process: 'SDRs manually prioritize leads by gut feel', ai_solution: 'XGBoost model scoring leads 1-10 on conversion probability', effort: 'medium', impact: 'high', roi_estimate_hours_saved_monthly: 20 },
        { title: 'Predictive Inventory Management', department: 'Operations', current_process: 'Monthly manual inventory count and reorder', ai_solution: 'ML demand forecasting driving automatic reorder triggers', effort: 'high', impact: 'high', roi_estimate_hours_saved_monthly: 25 },
      ],
      raw: 'Ollama unavailable — static fallback',
    });
  }
}
