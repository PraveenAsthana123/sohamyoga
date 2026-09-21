import { NextRequest, NextResponse } from 'next/server';
import { dispatchToOllama, getTaskModelMapping, getLiveModels, OllamaTaskType } from '@/lib/ollama-dispatcher';
import { query, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ensure the os_test_runs table exists
async function ensureTable() {
  if (!databaseConfigured()) return;
  await query(`
    CREATE TABLE IF NOT EXISTS os_test_runs (
      id SERIAL PRIMARY KEY,
      task_type TEXT NOT NULL,
      model_used TEXT NOT NULL,
      prompt TEXT NOT NULL,
      output TEXT NOT NULL,
      latency_ms INT NOT NULL,
      online BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// Model capability groupings for the fleet view
const MODEL_CAPABILITY_GROUPS: Record<string, string[]> = {
  Reasoning:  ['deepseek-r1:8b', 'qwen3:8b', 'phi4:14b', 'phi4:latest'],
  Code:       ['qwen2.5-coder:latest', 'qwen2.5-coder:14b', 'code-reviewer:latest', 'deepseek-coder-v2:latest', 'codegemma:7b'],
  General:    ['llama3.1:8b', 'llama3:latest', 'mistral:latest', 'qwen2.5:latest', 'gemma2:9b', 'gemma3:4b'],
  'Tool Use': ['llama3-groq-tool-use:latest', 'qwen3:8b'],
  Safety:     ['llama-guard3:latest', 'shieldgemma:9b'],
  Embedding:  ['nomic-embed-text:latest', 'mxbai-embed-large:latest', 'bge-m3:latest'],
  Vision:     ['qwen2.5vl:latest', 'llava:7b', 'gemma3:4b'],
};

interface OllamaModel {
  name: string;
  size?: number;
  details?: { parameter_size?: string; family?: string };
}

interface OllamaTagsResponse {
  models?: OllamaModel[];
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');

  if (action === 'fleet') {
    try {
      const res = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        return NextResponse.json({ error: 'Ollama offline', groups: {} }, { status: 200 });
      }
      const data = await res.json() as OllamaTagsResponse;
      const allModels = data.models ?? [];

      // Group models by capability
      const grouped: Record<string, { name: string; size_bytes: number; parameter_size: string; family: string; task_types: string[] }[]> = {};

      for (const [group, candidates] of Object.entries(MODEL_CAPABILITY_GROUPS)) {
        const matched = allModels
          .filter(m => candidates.some(c => m.name === c || m.name.startsWith(c.split(':')[0] + ':')))
          .map(m => ({
            name: m.name,
            size_bytes: m.size ?? 0,
            parameter_size: m.details?.parameter_size ?? 'unknown',
            family: m.details?.family ?? group.toLowerCase(),
            task_types: [], // populated below
          }));
        if (matched.length > 0) grouped[group] = matched;
      }

      // Also include unmatched models under "Other"
      const allGroupedNames = Object.values(grouped).flatMap(arr => arr.map(m => m.name));
      const other = allModels
        .filter(m => !allGroupedNames.includes(m.name))
        .map(m => ({
          name: m.name,
          size_bytes: m.size ?? 0,
          parameter_size: m.details?.parameter_size ?? 'unknown',
          family: m.details?.family ?? 'other',
          task_types: [] as string[],
        }));
      if (other.length > 0) grouped['Other'] = other;

      return NextResponse.json({ groups: grouped, total: allModels.length });
    } catch {
      return NextResponse.json({ error: 'Ollama unreachable', groups: {} }, { status: 200 });
    }
  }

  // Default: task-model mapping + stats
  try {
    await ensureTable();

    const [mapping, liveModels] = await Promise.all([
      getTaskModelMapping(),
      getLiveModels(),
    ]);

    let tasksToday = 0;
    if (databaseConfigured()) {
      const res = await query(
        `SELECT COUNT(*) AS cnt FROM os_test_runs WHERE created_at >= NOW() - INTERVAL '24 hours'`
      );
      tasksToday = parseInt((res.rows[0] as { cnt: string }).cnt, 10);
    }

    return NextResponse.json({
      task_model_mapping: mapping,
      stats: {
        models_online: liveModels.length,
        tasks_today: tasksToday,
        routes_using_dispatcher: 3,
        routes_using_raw_llama: 413,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();

    const body = await req.json() as { task_type?: string; prompt?: string; temperature?: number };
    const taskType = (body.task_type ?? 'text_generation') as OllamaTaskType;
    const prompt = body.prompt ?? '';
    const temperature = body.temperature ?? 0.7;

    if (!prompt.trim()) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const result = await dispatchToOllama(taskType, prompt, { temperature });

    if (databaseConfigured()) {
      await query(
        `INSERT INTO os_test_runs (task_type, model_used, prompt, output, latency_ms, online)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          result.task_type,
          result.model_used,
          prompt,
          result.output,
          result.latency_ms,
          result.status === 'completed',
        ]
      );
    }

    return NextResponse.json({
      model_used: result.model_used,
      latency_ms: result.latency_ms,
      output: result.output,
      online: result.status === 'completed',
      task_type: result.task_type,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
