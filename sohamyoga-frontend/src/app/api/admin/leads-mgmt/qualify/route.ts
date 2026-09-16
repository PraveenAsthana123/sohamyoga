import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { lead_id, action } = await req.json() as { lead_id?: number; action?: string };
  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

  const leadResult = await pool.query(`SELECT * FROM lead WHERE id=$1`, [lead_id]);
  if (leadResult.rowCount === 0) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const lead = leadResult.rows[0] as {
    first_name: string; last_name: string; email: string; company: string;
    job_title: string; lead_source: string; lead_stage: string; lead_score: number;
    deal_value: string; notes: string;
  };

  let prompt = '';

  if (action === 'draft-email') {
    prompt = `Write a professional outreach email for this lead:
Name: ${lead.first_name} ${lead.last_name}
Company: ${lead.company || 'N/A'}
Job Title: ${lead.job_title || 'N/A'}
Lead Source: ${lead.lead_source}
Notes: ${lead.notes || 'None'}

Write a warm, personalized email for a yoga/wellness studio. Keep it under 200 words.
Respond with JSON: { "subject": "<email subject>", "body": "<email body>" }
Only return valid JSON.`;
  } else {
    prompt = `You are a sales qualification expert. Analyze this lead profile for a yoga/wellness studio:
Name: ${lead.first_name} ${lead.last_name}
Company: ${lead.company || 'N/A'}, Job Title: ${lead.job_title || 'N/A'}
Lead Source: ${lead.lead_source}, Stage: ${lead.lead_stage}
Current Score: ${lead.lead_score}/100
Deal Value: $${lead.deal_value || 0}
Notes: ${lead.notes || 'None'}

Provide: 1) qualification analysis, 2) score explanation, 3) next best action, 4) risk factors.
Respond with JSON: {
  "qualification_summary": "<2-3 sentences>",
  "score_explanation": "<breakdown of score>",
  "next_best_action": "<specific recommended action>",
  "risk_factors": ["risk1", "risk2"],
  "recommended_stage": "<new|contacted|qualified|proposal|negotiation>"
}
Only return valid JSON.`;
  }

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
    });

    if (!ollamaRes.ok) throw new Error(`Ollama error: ${ollamaRes.status}`);
    const data = await ollamaRes.json() as { response?: string };
    const raw = (data.response ?? '').trim();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ result: { qualification_summary: raw } });

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return NextResponse.json({ result: parsed, lead });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
