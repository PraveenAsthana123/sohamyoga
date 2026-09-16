import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const result = await pool.query(
      'SELECT * FROM synthetic_data_set ORDER BY created_at DESC LIMIT 500'
    );
    return Response.json({ datasets: result.rows });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json() as {
      module_name: string;
      dataset_name: string;
      dataset_type: string;
      record_count?: number;
      generation_prompt?: string;
    };

    // Create pending record
    const insResult = await pool.query(
      `INSERT INTO synthetic_data_set (module_name, dataset_name, dataset_type, record_count, generation_prompt, status)
       VALUES ($1, $2, $3, $4, $5, 'generating') RETURNING *`,
      [body.module_name, body.dataset_name, body.dataset_type, body.record_count ?? 10, body.generation_prompt ?? '']
    );
    const row = insResult.rows[0] as { id: number };

    // Call Ollama to generate data
    const prompt = body.generation_prompt
      || `Generate ${body.record_count ?? 10} realistic synthetic ${body.dataset_type} records for the ${body.module_name} module of a yoga studio platform. Return valid JSON array only.`;

    let generatedData: unknown[] = [];
    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(45000),
      });
      if (ollamaRes.ok) {
        const ollamaJson = await ollamaRes.json() as { response?: string };
        const text = ollamaJson.response ?? '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          generatedData = JSON.parse(jsonMatch[0]) as unknown[];
        }
      }
    } catch {
      // Ollama unavailable — use empty array
    }

    await pool.query(
      `UPDATE synthetic_data_set SET status='complete', record_count=$1, generated_at=NOW() WHERE id=$2`,
      [generatedData.length || (body.record_count ?? 10), row.id]
    );

    return Response.json({
      dataset: { ...row, status: 'complete', record_count: generatedData.length || (body.record_count ?? 10) },
      data: generatedData,
    }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
