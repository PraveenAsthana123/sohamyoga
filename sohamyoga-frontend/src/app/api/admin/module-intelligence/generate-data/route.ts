import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/module-intelligence-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OllamaResponse {
  response?: string;
  done?: boolean;
}

async function callOllama(prompt: string): Promise<string> {
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json() as OllamaResponse;
  return data.response ?? '';
}

function extractJsonArray(text: string): unknown[] {
  // Try fenced first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = fenced.indexOf('[');
  const end = fenced.lastIndexOf(']');
  if (start >= 0 && end > start) {
    try { return JSON.parse(fenced.slice(start, end + 1)) as unknown[]; } catch { /* fall through */ }
  }
  return [];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  await ensureSchema();
  const body = await req.json() as {
    module_key: string; count?: number; kaggle_ref?: string; source?: string;
  };

  if (!body.module_key) return NextResponse.json({ error: 'module_key required' }, { status: 400 });

  // Kaggle reference — just save the ref without generating
  if (body.source === 'kaggle' && body.kaggle_ref) {
    const result = await query(
      `INSERT INTO test_dataset (module_key, dataset_name, source, kaggle_ref, record_count, status, generated_by)
       VALUES ($1,$2,'kaggle',$3,0,'available','user')
       RETURNING *`,
      [body.module_key, `Kaggle: ${body.kaggle_ref}`, body.kaggle_ref],
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  }

  // Get module info
  const modRes = await query('SELECT name FROM module_registry WHERE module_key = $1', [body.module_key]);
  if (!modRes.rows.length) return NextResponse.json({ error: 'Module not found' }, { status: 404 });
  const moduleName = (modRes.rows[0] as { name: string }).name;

  const count = Math.min(body.count ?? 10, 500);
  const schemaFields = { id: 'uuid', module_key: 'text', tenant_id: 'text', name: 'text', status: 'text', value: 'numeric', created_at: 'date', description: 'text' };

  const prompt = `Generate ${count} realistic JSON records for a ${moduleName} module in a digital marketing platform. Return only a JSON array with no explanation. Each record should have: ${JSON.stringify(schemaFields)}`;

  let sampleRows: unknown[] = [];
  let generated_by = 'ollama';

  try {
    const ollamaText = await callOllama(prompt);
    sampleRows = extractJsonArray(ollamaText);
    if (!sampleRows.length) throw new Error('No JSON array found in response');
  } catch (err) {
    // Fallback: generate synthetic rows without Ollama
    generated_by = 'system-fallback';
    sampleRows = Array.from({ length: Math.min(count, 10) }, (_, i) => ({
      id: `${Date.now()}-${i}`, module_key: body.module_key, tenant_id: `demo-tenant-0${(i % 3) + 1}`,
      name: `${moduleName} Record ${i + 1}`, status: ['active', 'pending', 'completed'][i % 3],
      value: (i + 1) * 50, created_at: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
      description: `Synthetic ${moduleName} data record ${i + 1}`,
    }));
    console.warn('[generate-data] Ollama unavailable, used fallback:', (err as Error).message);
  }

  const result = await query(
    `INSERT INTO test_dataset (module_key, dataset_name, source, record_count, schema_definition, sample_rows, status, generated_by)
     VALUES ($1,$2,'synthetic',$3,$4::jsonb,$5::jsonb,'available',$6)
     RETURNING *`,
    [body.module_key, `${moduleName} Generated Dataset (${count} rows)`,
      sampleRows.length, JSON.stringify(schemaFields), JSON.stringify(sampleRows.slice(0, 50)), generated_by],
  );

  return NextResponse.json({ ...result.rows[0], total_generated: sampleRows.length }, { status: 201 });
}
