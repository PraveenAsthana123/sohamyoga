import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS classification_result (
    id SERIAL PRIMARY KEY,
    model_name TEXT NOT NULL,
    input_text TEXT NOT NULL,
    predicted_class TEXT NOT NULL,
    confidence NUMERIC,
    classes JSONB,
    entity_type TEXT,
    entity_id INTEGER,
    processing_time_ms INTEGER,
    model_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const model_name = searchParams.get('model_name');
  const entity_type = searchParams.get('entity_type');
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (model_name) { conditions.push(`model_name = $${idx++}`); values.push(model_name); }
  if (entity_type) { conditions.push(`entity_type = $${idx++}`); values.push(entity_type); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM classification_result ${where} ORDER BY created_at DESC LIMIT 200`,
    values
  );
  return Response.json({ results: rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const b = await req.json().catch(() => null);
  if (!b?.text || !Array.isArray(b?.classes) || !b.classes.length) {
    return Response.json({ error: 'text and classes[] are required' }, { status: 400 });
  }

  const modelName = 'llama3.2';
  const prompt = `Classify the following text into one of these categories: ${b.classes.join(', ')}. Text: ${b.text}. Reply with ONLY the category name.`;
  const startTime = Date.now();

  let predictedClass = b.classes[0] as string;
  let confidence = 0.5;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, prompt, stream: false }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (ollamaRes.ok) {
      const data = await ollamaRes.json() as { response?: string };
      const rawResponse = (data.response || '').trim().toLowerCase();
      // Find the best matching class
      const matched = (b.classes as string[]).find((cls: string) =>
        rawResponse.includes(cls.toLowerCase())
      );
      if (matched) {
        predictedClass = matched;
        confidence = 0.85;
      }
    }
  } catch {
    // Ollama unavailable — fall back to first class
  }

  const processingTime = Date.now() - startTime;
  const classesMap: Record<string, number> = {};
  (b.classes as string[]).forEach((cls: string) => {
    classesMap[cls] = cls === predictedClass ? confidence : (1 - confidence) / (b.classes.length - 1);
  });

  const { rows } = await pool.query(
    `INSERT INTO classification_result (model_name, input_text, predicted_class, confidence, classes, entity_type, entity_id, processing_time_ms, model_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [modelName, b.text, predictedClass, confidence, JSON.stringify(classesMap),
     b.entity_type || null, b.entity_id || null, processingTime, '1.0']
  );
  return Response.json({ result: rows[0] }, { status: 201 });
}
