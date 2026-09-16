export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { prompt, check_type = 'factual' } = await req.json().catch(() => ({ prompt: '', check_type: 'factual' }));
    if (!prompt) return Response.json({ error: 'prompt is required' }, { status: 400 });

    // Step 1: Generate response with Ollama
    let modelResponse = 'Ollama unavailable — using stub response for demonstration.';
    try {
      const genRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(25000),
      });
      if (genRes.ok) {
        const genJson = await genRes.json();
        modelResponse = genJson.response ?? modelResponse;
      }
    } catch { /* use fallback */ }

    // Step 2: Verify with second Ollama call
    let hallucination_detected = false;
    let confidence = 0.5;
    let evidence = 'Verification call failed — manual review required.';

    try {
      const verifyPrompt = `You are a fact-checking AI. Analyze this AI response for hallucinations, false claims, or unverifiable statements.

Original Prompt: "${prompt}"
AI Response: "${modelResponse}"

Respond in JSON format exactly like this:
{"hallucination_detected": true/false, "confidence": 0.0-1.0, "evidence": "brief explanation"}`;

      const verifyRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt: verifyPrompt, stream: false }),
        signal: AbortSignal.timeout(25000),
      });
      if (verifyRes.ok) {
        const verifyJson = await verifyRes.json();
        const raw = verifyJson.response ?? '{}';
        const match = raw.match(/\{[\s\S]*?\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          hallucination_detected = parsed.hallucination_detected ?? false;
          confidence = parseFloat(parsed.confidence) || 0.5;
          evidence = parsed.evidence ?? evidence;
        }
      }
    } catch { /* use defaults */ }

    // Record result
    const { rows } = await client.query(
      `INSERT INTO hallucination_checks (model_name, prompt, response, check_type, hallucination_detected, confidence, evidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      ['llama3.2', prompt, modelResponse, check_type, hallucination_detected, confidence, evidence]
    );

    return Response.json({
      check: rows[0],
      model_response: modelResponse,
      hallucination_detected,
      confidence,
      evidence,
    });
  } finally {
    client.release();
  }
}
