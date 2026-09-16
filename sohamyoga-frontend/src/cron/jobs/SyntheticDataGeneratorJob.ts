/**
 * SyntheticDataGeneratorJob — runs every Sunday at 3am UTC.
 * Generates synthetic data for each pending synthetic_data_set record using Ollama llama3.2.
 */
import { pool } from '@/lib/db';

async function callOllama(prompt: string): Promise<unknown[]> {
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { response?: string };
    const text = data.response ?? '';
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as unknown[];
  } catch {
    // Ollama unavailable — skip
  }
  return [];
}

export async function run(): Promise<void> {
  const rows = await pool.query(
    "SELECT * FROM synthetic_data_set WHERE status = 'pending' ORDER BY created_at LIMIT 10"
  );

  if (rows.rowCount === 0) {
    console.log('[SyntheticDataGeneratorJob] No pending datasets — nothing to do.');
    return;
  }

  for (const row of rows.rows as Array<{
    id: number;
    module_name: string;
    dataset_name: string;
    dataset_type: string;
    record_count: number;
    generation_prompt: string;
  }>) {
    console.log(`[SyntheticDataGeneratorJob] Generating "${row.dataset_name}" (${row.record_count} records)...`);

    await pool.query(
      "UPDATE synthetic_data_set SET status = 'generating' WHERE id = $1",
      [row.id]
    );

    const prompt =
      row.generation_prompt ||
      `Generate ${row.record_count} realistic synthetic ${row.dataset_type} records for the ${row.module_name} module of a yoga studio. Return valid JSON array only.`;

    const generated = await callOllama(prompt);
    const actualCount = generated.length || row.record_count;

    await pool.query(
      "UPDATE synthetic_data_set SET status = 'complete', record_count = $1, generated_at = NOW() WHERE id = $2",
      [actualCount, row.id]
    );

    console.log(`[SyntheticDataGeneratorJob] Completed "${row.dataset_name}" — ${actualCount} records.`);
  }

  console.log(`[SyntheticDataGeneratorJob] Done. Processed ${rows.rowCount} datasets.`);
}
