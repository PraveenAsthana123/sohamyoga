export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

async function ensureTables() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ot_tasks (
        task_id VARCHAR(64) PRIMARY KEY,
        task_type VARCHAR(64) NOT NULL,
        model_name VARCHAR(128) NOT NULL,
        prompt TEXT NOT NULL,
        output TEXT,
        temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7,
        max_tokens INT NOT NULL DEFAULT 512,
        status VARCHAR(32) NOT NULL DEFAULT 'queued',
        latency_ms INT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ot_models (
        model_name VARCHAR(128) PRIMARY KEY,
        size_gb NUMERIC(5,2) NOT NULL DEFAULT 0,
        family VARCHAR(64) NOT NULL,
        capabilities TEXT[] NOT NULL DEFAULT '{}',
        status VARCHAR(32) NOT NULL DEFAULT 'available',
        last_used TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ot_config (
        key VARCHAR(64) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const models = [
      ['llama3.2:3b',1.9,'llama','{"text","code","summarization"}','available'],
      ['mistral:7b',4.1,'mistral','{"text","code","translation"}','available'],
      ['gemma2:9b',5.4,'gemma','{"text","summarization","classification"}','available'],
      ['phi3:mini',2.2,'phi','{"text","code","q_a"}','loaded'],
      ['qwen2.5:7b',4.7,'qwen','{"text","translation","code"}','available'],
      ['nomic-embed-text',0.3,'nomic','{"embedding"}','available'],
    ];
    for (const [name,size,family,caps,st] of models) {
      await client.query(
        `INSERT INTO ot_models (model_name,size_gb,family,capabilities,status,last_used)
         VALUES ($1,$2,$3,$4::text[],$5,NOW()) ON CONFLICT DO NOTHING`,
        [name,size,family,caps,st]
      );
    }

    const tasks = [
      ['task-001','Text Generation','llama3.2:3b','Write a short introduction for a yoga studio',
       'Welcome to our yoga studio, a sanctuary of peace and wellness...','completed',342],
      ['task-002','Summarization','mistral:7b','Summarize the benefits of meditation for stress reduction',
       'Meditation reduces cortisol, improves focus, and promotes emotional well-being.','completed',521],
      ['task-003','Classification','gemma2:9b','Classify this customer review: "Great classes!"',
       'Positive sentiment, 5/5 stars, category: Customer Service','completed',289],
      ['task-004','Sentiment Analysis','phi3:mini','Is this text positive or negative: "I love the morning classes"',
       'Sentiment: Positive (confidence: 0.97)','completed',198],
      ['task-005','Q&A','llama3.2:3b','What are the best yoga poses for back pain?',
       'Cat-cow, child\'s pose, and downward dog are excellent for back pain relief.','completed',445],
      ['task-006','Translation','qwen2.5:7b','Translate to French: Welcome to our wellness center',
       'Bienvenue dans notre centre de bien-être','completed',367],
      ['task-007','Code Generation','mistral:7b','Write a Python function to calculate BMI',
       'def bmi(weight_kg, height_m): return weight_kg / (height_m ** 2)','completed',612],
      ['task-008','Entity Extraction','gemma2:9b','Extract names from: Dr. Patel teaches Priya and Amit',
       'Entities: [Dr. Patel (PERSON), Priya (PERSON), Amit (PERSON)]','completed',310],
      ['task-009','Embedding','nomic-embed-text','Generate embedding for: yoga wellness health',
       '[0.123, -0.456, 0.789, ...]','completed',145],
      ['task-010','Summarization','llama3.2:3b','Summarize: 3-hour workshop on mindfulness',
       'The workshop covered breath awareness, body scanning, and compassion practices.','completed',498],
    ];
    for (const [id,tt,mn,p,o,st,lat] of tasks) {
      await client.query(
        `INSERT INTO ot_tasks (task_id,task_type,model_name,prompt,output,status,latency_ms,completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) ON CONFLICT DO NOTHING`,
        [id,tt,mn,p,o,st,lat]
      );
    }

    const configs = [
      ['base_url','http://localhost:11434'],
      ['timeout_seconds','30'],
      ['max_concurrent','3'],
      ['default_text_model','llama3.2:3b'],
      ['default_code_model','mistral:7b'],
      ['default_embed_model','nomic-embed-text'],
    ];
    for (const [k,v] of configs) {
      await client.query(
        `INSERT INTO ot_config VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [k,v]
      );
    }
  } finally {
    client.release();
  }
}

async function getOllamaBaseUrl(): Promise<string> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(`SELECT value FROM ot_config WHERE key='base_url'`);
    return r.rows[0]?.value || 'http://localhost:11434';
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [tasks, models, config] = await Promise.all([
      client.query('SELECT * FROM ot_tasks ORDER BY created_at DESC LIMIT 100'),
      client.query('SELECT * FROM ot_models ORDER BY model_name'),
      client.query('SELECT * FROM ot_config'),
    ]);

    // Try to fetch live tags from Ollama; fall back to DB models if offline
    const baseUrl = config.rows.find(r => r.key === 'base_url')?.value || 'http://localhost:11434';
    let liveModels: string[] = [];
    let ollamaOnline = false;
    try {
      const resp = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) {
        const data = await resp.json() as { models?: { name: string }[] };
        liveModels = (data.models || []).map((m: { name: string }) => m.name);
        ollamaOnline = true;
      }
    } catch {
      // offline — use DB models only
    }

    const completed = tasks.rows.filter(t => t.status === 'completed').length;
    const queued = tasks.rows.filter(t => t.status === 'queued').length;
    const completedToday = tasks.rows.filter(t => {
      if (t.status !== 'completed' || !t.completed_at) return false;
      const d = new Date(t.completed_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    const latencies = tasks.rows.filter(t => t.latency_ms).map(t => Number(t.latency_ms));
    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length)
      : 0;

    return NextResponse.json({
      tasks: tasks.rows,
      models: models.rows,
      config: config.rows,
      ollama_online: ollamaOnline,
      live_models: liveModels,
      summary: {
        available_models: models.rows.length,
        tasks_queued: queued,
        completed_today: completedToday,
        avg_response_ms: avgLatency,
      },
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  await ensureTables();
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();

  const taskId = `task-${Date.now()}`;
  const { task_type, model_name, prompt, temperature = 0.7, max_tokens = 512 } = body;

  // Insert task as queued first
  await client.query(
    `INSERT INTO ot_tasks (task_id,task_type,model_name,prompt,temperature,max_tokens,status)
     VALUES ($1,$2,$3,$4,$5,$6,'running')`,
    [taskId, task_type, model_name, prompt, temperature, max_tokens]
  );
  client.release();

  const baseUrl = await getOllamaBaseUrl();
  const start = Date.now();

  try {
    const resp = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model_name,
        prompt,
        stream: false,
        options: { temperature, num_predict: max_tokens },
      }),
      signal: AbortSignal.timeout(30000),
    });

    const latency = Date.now() - start;

    if (!resp.ok) {
      const errText = await resp.text();
      const c2 = await pool.connect();
      try {
        await c2.query(
          `UPDATE ot_tasks SET status='error', output=$1, latency_ms=$2, completed_at=NOW() WHERE task_id=$3`,
          [errText, latency, taskId]
        );
        const r = await c2.query('SELECT * FROM ot_tasks WHERE task_id=$1', [taskId]);
        return NextResponse.json(r.rows[0]);
      } finally {
        c2.release();
      }
    }

    const data = await resp.json() as { response?: string };
    const output = data.response || '';
    const c2 = await pool.connect();
    try {
      await c2.query(
        `UPDATE ot_tasks SET status='completed', output=$1, latency_ms=$2, completed_at=NOW() WHERE task_id=$3`,
        [output, latency, taskId]
      );
      await c2.query(`UPDATE ot_models SET last_used=NOW() WHERE model_name=$1`, [model_name]);
      const r = await c2.query('SELECT * FROM ot_tasks WHERE task_id=$1', [taskId]);
      return NextResponse.json(r.rows[0]);
    } finally {
      c2.release();
    }
  } catch {
    const latency = Date.now() - start;
    const c2 = await pool.connect();
    try {
      await c2.query(
        `UPDATE ot_tasks SET status='ollama_offline', output=$1, latency_ms=$2, completed_at=NOW() WHERE task_id=$3`,
        ['Ollama service is offline or not reachable at ' + baseUrl, latency, taskId]
      );
      const r = await c2.query('SELECT * FROM ot_tasks WHERE task_id=$1', [taskId]);
      return NextResponse.json(r.rows[0]);
    } finally {
      c2.release();
    }
  }
}

export async function PATCH(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  await ensureTables();
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `UPDATE ot_tasks SET status='cancelled' WHERE task_id=$1 AND status IN ('queued','running') RETURNING *`,
      [body.task_id]
    );
    return NextResponse.json(r.rows[0] || { error: 'Task not found or already finished' });
  } finally {
    client.release();
  }
}
