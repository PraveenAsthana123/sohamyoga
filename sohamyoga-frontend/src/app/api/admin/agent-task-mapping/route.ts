import { NextRequest } from 'next/server';
import { getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { dispatchToOllama, getTaskModelMapping, type OllamaTaskType } from '@/lib/ollama-dispatcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS atm_task_mappings (
        id SERIAL PRIMARY KEY,
        input_type VARCHAR(100) NOT NULL,
        subtask_name VARCHAR(200) NOT NULL,
        model_type VARCHAR(100) NOT NULL,
        model_name VARCHAR(100) NOT NULL,
        agent_type VARCHAR(100) NOT NULL,
        agent_name VARCHAR(100) NOT NULL,
        avg_latency_ms INT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS atm_executions (
        id SERIAL PRIMARY KEY,
        execution_id VARCHAR(100) UNIQUE NOT NULL,
        input_type VARCHAR(100) NOT NULL,
        input_data TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP,
        subtask_count INT NOT NULL DEFAULT 0,
        total_latency_ms INT NOT NULL DEFAULT 0
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS atm_models (
        id SERIAL PRIMARY KEY,
        model_id VARCHAR(100) UNIQUE NOT NULL,
        model_name VARCHAR(100) NOT NULL,
        model_type VARCHAR(100) NOT NULL,
        provider VARCHAR(50) NOT NULL DEFAULT 'Ollama',
        status VARCHAR(30) NOT NULL DEFAULT 'idle',
        last_used_at TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS atm_agents (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(100) UNIQUE NOT NULL,
        agent_name VARCHAR(100) NOT NULL,
        agent_type VARCHAR(100) NOT NULL,
        capabilities JSONB NOT NULL DEFAULT '[]',
        status VARCHAR(30) NOT NULL DEFAULT 'idle',
        active_tasks INT NOT NULL DEFAULT 0
      )
    `);

    // Seed task mappings
    const existing = await client.query('SELECT COUNT(*) FROM atm_task_mappings');
    if (parseInt(existing.rows[0].count) === 0) {
      const mappings: Array<[string, string, string, string, string, string, number]> = [
        // Generate Marketing Content
        ['Generate Marketing Content', 'Keyword extraction & topic modeling', 'NLP', 'spaCy NLP (local)', 'Single Agent', 'TextAnalyst-1', 120],
        ['Generate Marketing Content', 'SEO keyword ranking analysis', 'Statistical', 'TF-IDF Scorer (local)', 'Tool-Use Agent', 'SEOAgent-1', 85],
        ['Generate Marketing Content', 'Content draft generation', 'Transformer/LLM', 'llama3.2:3b (Ollama)', 'Single Agent', 'ContentWriter-1', 2400],
        ['Generate Marketing Content', 'Brand voice compliance check', 'Rule-Based', 'BrandGuardian Rules (local)', 'Pipeline Agent', 'BrandChecker-1', 45],
        ['Generate Marketing Content', 'Final copy optimization', 'Transformer/LLM', 'mistral:7b (Ollama)', 'Supervisor Agent', 'CopyEditor-1', 1800],

        // Analyze Campaign Performance
        ['Analyze Campaign Performance', 'Ingest campaign metrics from DB', 'Deterministic', 'SQL Aggregator (local)', 'Single Agent', 'DataFetcher-1', 30],
        ['Analyze Campaign Performance', 'Anomaly detection on spend vs conversions', 'Statistical', 'Z-Score Detector (local)', 'Single Agent', 'AnomalyAgent-1', 200],
        ['Analyze Campaign Performance', 'Attribution modeling', 'ML/Deep Learning', 'Attribution MLP (custom)', 'Pipeline Agent', 'AttributionAgent-1', 850],
        ['Analyze Campaign Performance', 'ROAS forecasting (next 7d)', 'Time Series', 'Prophet (local)', 'Single Agent', 'ForecastAgent-1', 640],
        ['Analyze Campaign Performance', 'Natural language summary generation', 'Transformer/LLM', 'llama3.2:3b (Ollama)', 'Supervisor Agent', 'ReportWriter-1', 1600],

        // Process Customer Order
        ['Process Customer Order', 'Validate order payload & inventory check', 'Rule-Based', 'OrderValidator Rules (local)', 'Single Agent', 'Validator-1', 25],
        ['Process Customer Order', 'Fraud scoring', 'ML/Deep Learning', 'FraudNet v2 (custom)', 'Single Agent', 'FraudAgent-1', 180],
        ['Process Customer Order', 'Payment gateway routing decision', 'Probabilistic', 'Bayesian Router (local)', 'Tool-Use Agent', 'PaymentRouter-1', 60],
        ['Process Customer Order', 'Fulfillment workflow dispatch', 'Deterministic', 'Order Orchestrator (local)', 'Pipeline Agent', 'FulfillmentAgent-1', 90],
        ['Process Customer Order', 'Post-order confirmation email', 'Rule-Based', 'Template Engine (local)', 'Single Agent', 'NotifyAgent-1', 35],

        // Social Media Post
        ['Social Media Post', 'Audience & timing analysis', 'Statistical', 'Engagement Predictor (local)', 'Single Agent', 'AudienceAgent-1', 150],
        ['Social Media Post', 'Platform-specific content adaptation', 'Transformer/LLM', 'mistral:7b (Ollama)', 'Multi-Agent', 'ContentAdapter-1', 2200],
        ['Social Media Post', 'Hashtag & trend discovery', 'NLP', 'Trend Extractor NLP (local)', 'Tool-Use Agent', 'TrendAgent-1', 320],
        ['Social Media Post', 'Visual asset suggestion', 'Computer Vision', 'CLIP Embedder (local)', 'Single Agent', 'VisualAgent-1', 480],
        ['Social Media Post', 'Compliance & sentiment gate', 'NLP', 'Sentiment Classifier (local)', 'Pipeline Agent', 'GateAgent-1', 110],

        // Video Generation Request
        ['Video Generation Request', 'Script outline generation', 'Transformer/LLM', 'llama3.2:3b (Ollama)', 'Single Agent', 'Scriptwriter-1', 3200],
        ['Video Generation Request', 'Voice narration synthesis', 'Transformer/LLM', 'ElevenLabs TTS (API)', 'Tool-Use Agent', 'VoiceAgent-1', 4500],
        ['Video Generation Request', 'B-roll footage matching', 'Computer Vision', 'CLIP Searcher (local)', 'Single Agent', 'BRollAgent-1', 900],
        ['Video Generation Request', 'Subtitle generation', 'NLP', 'Whisper STT (local)', 'Single Agent', 'SubtitleAgent-1', 2100],
        ['Video Generation Request', 'Final render & quality check', 'Deterministic', 'FFmpeg Processor (local)', 'Agent Mesh', 'RenderMesh-1', 12000],

        // Email Campaign
        ['Email Campaign', 'Segment audience by behavior', 'ML/Deep Learning', 'Segmentation DNN (custom)', 'Single Agent', 'SegmentAgent-1', 420],
        ['Email Campaign', 'Subject line A/B variants', 'Transformer/LLM', 'mistral:7b (Ollama)', 'Single Agent', 'SubjectAgent-1', 1400],
        ['Email Campaign', 'Personalization token injection', 'Rule-Based', 'Personalization Engine (local)', 'Pipeline Agent', 'PersonalizeAgent-1', 75],
        ['Email Campaign', 'Send-time optimization', 'Time Series', 'Engagement ARIMA (local)', 'Single Agent', 'SendTimeAgent-1', 280],

        // SEO Analysis
        ['SEO Analysis', 'On-page technical crawl', 'Deterministic', 'SEO Crawler (local)', 'Single Agent', 'CrawlAgent-1', 1200],
        ['SEO Analysis', 'Keyword gap analysis', 'Statistical', 'TF-IDF Gap Analyzer (local)', 'Tool-Use Agent', 'KeywordAgent-1', 380],
        ['SEO Analysis', 'Competitor backlink profiling', 'Statistical', 'Link Scorer (local)', 'Single Agent', 'BacklinkAgent-1', 650],
        ['SEO Analysis', 'Content recommendations', 'Transformer/LLM', 'llama3.2:3b (Ollama)', 'Supervisor Agent', 'ContentSEOAgent-1', 2000],

        // Product Recommendation
        ['Product Recommendation', 'User behavior embedding', 'ML/Deep Learning', 'Embedding MLP (custom)', 'Single Agent', 'EmbedAgent-1', 220],
        ['Product Recommendation', 'Collaborative filtering', 'ML/Deep Learning', 'CF Model v3 (custom)', 'Single Agent', 'CollabAgent-1', 310],
        ['Product Recommendation', 'Real-time ranking', 'Reinforcement Learning', 'Bandit Ranker (local)', 'Single Agent', 'RankAgent-1', 95],
        ['Product Recommendation', 'Explanation generation', 'Transformer/LLM', 'llama3.2:3b (Ollama)', 'Tool-Use Agent', 'ExplainAgent-1', 1100],
      ];

      for (const [input_type, subtask_name, model_type, model_name, agent_type, agent_name, avg_latency_ms] of mappings) {
        await client.query(
          `INSERT INTO atm_task_mappings (input_type, subtask_name, model_type, model_name, agent_type, agent_name, avg_latency_ms, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
          [input_type, subtask_name, model_type, model_name, agent_type, agent_name, avg_latency_ms],
        );
      }
    }

    // Seed models
    const mExisting = await client.query('SELECT COUNT(*) FROM atm_models');
    if (parseInt(mExisting.rows[0].count) === 0) {
      const models: Array<[string, string, string, string, string]> = [
        ['mdl-llama32', 'llama3.2:3b', 'Transformer/LLM', 'Ollama', 'active'],
        ['mdl-mistral7b', 'mistral:7b', 'Transformer/LLM', 'Ollama', 'active'],
        ['mdl-prophet', 'Prophet', 'Time Series', 'Custom', 'idle'],
        ['mdl-whisper', 'Whisper STT', 'NLP', 'HuggingFace', 'idle'],
        ['mdl-clip', 'CLIP Embedder', 'Computer Vision', 'HuggingFace', 'idle'],
        ['mdl-fraudnet', 'FraudNet v2', 'ML/Deep Learning', 'Custom', 'idle'],
        ['mdl-spacy', 'spaCy NLP', 'NLP', 'Custom', 'active'],
        ['mdl-tfidf', 'TF-IDF Scorer', 'Statistical', 'Custom', 'active'],
        ['mdl-bandit', 'Bandit Ranker', 'Reinforcement Learning', 'Custom', 'idle'],
        ['mdl-elevenlabs', 'ElevenLabs TTS', 'Transformer/LLM', 'OpenAI', 'idle'],
      ];
      for (const [model_id, model_name, model_type, provider, status] of models) {
        await client.query(
          `INSERT INTO atm_models (model_id, model_name, model_type, provider, status)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (model_id) DO NOTHING`,
          [model_id, model_name, model_type, provider, status],
        );
      }
    }

    // Seed agents
    const aExisting = await client.query('SELECT COUNT(*) FROM atm_agents');
    if (parseInt(aExisting.rows[0].count) === 0) {
      const agents: Array<[string, string, string, string[], string, number]> = [
        ['agt-contentwriter', 'ContentWriter-1', 'Single Agent', ['text-generation', 'brand-voice', 'copywriting'], 'active', 1],
        ['agt-seoagent', 'SEOAgent-1', 'Tool-Use Agent', ['keyword-research', 'seo-audit', 'serp-analysis'], 'active', 2],
        ['agt-fraudagent', 'FraudAgent-1', 'Single Agent', ['fraud-scoring', 'risk-assessment', 'pattern-detection'], 'idle', 0],
        ['agt-reportwriter', 'ReportWriter-1', 'Supervisor Agent', ['nlg', 'report-generation', 'data-summarization', 'kpi-analysis'], 'active', 1],
        ['agt-rendermesh', 'RenderMesh-1', 'Agent Mesh', ['video-rendering', 'ffmpeg', 'quality-assurance', 'format-conversion'], 'idle', 0],
        ['agt-contentadapter', 'ContentAdapter-1', 'Multi-Agent', ['platform-adaptation', 'instagram', 'linkedin', 'twitter', 'facebook'], 'active', 3],
        ['agt-personalizeagent', 'PersonalizeAgent-1', 'Pipeline Agent', ['personalization', 'token-injection', 'template-rendering'], 'idle', 0],
        ['agt-segmentagent', 'SegmentAgent-1', 'Single Agent', ['audience-segmentation', 'behavioral-analysis', 'cohort-building'], 'active', 1],
        ['agt-forecastagent', 'ForecastAgent-1', 'Single Agent', ['time-series-forecasting', 'roas-prediction', 'trend-analysis'], 'idle', 0],
        ['agt-rankagent', 'RankAgent-1', 'Single Agent', ['product-ranking', 'real-time-scoring', 'recommendation'], 'active', 2],
      ];
      for (const [agent_id, agent_name, agent_type, capabilities, status, active_tasks] of agents) {
        await client.query(
          `INSERT INTO atm_agents (agent_id, agent_name, agent_type, capabilities, status, active_tasks)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (agent_id) DO NOTHING`,
          [agent_id, agent_name, agent_type, JSON.stringify(capabilities), status, active_tasks],
        );
      }
    }

    // Seed some recent executions
    const eExisting = await client.query('SELECT COUNT(*) FROM atm_executions');
    if (parseInt(eExisting.rows[0].count) === 0) {
      const execs: Array<[string, string, string, string, number, number]> = [
        ['exec-001', 'Generate Marketing Content', 'Write blog post about AI in yoga', 'completed', 5, 6450],
        ['exec-002', 'Social Media Post', 'Instagram reel caption for morning practice', 'completed', 5, 3260],
        ['exec-003', 'Analyze Campaign Performance', 'Q3 2026 summer campaign review', 'completed', 5, 3320],
        ['exec-004', 'Email Campaign', 'Back-to-school yoga promotion', 'running', 4, 0],
        ['exec-005', 'SEO Analysis', 'yoga-calgary.com full site audit', 'pending', 0, 0],
      ];
      for (const [execution_id, input_type, input_data, status, subtask_count, total_latency_ms] of execs) {
        await client.query(
          `INSERT INTO atm_executions (execution_id, input_type, input_data, status, subtask_count, total_latency_ms,
            started_at, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6,
             NOW() - interval '1 hour',
             CASE WHEN $4 = 'completed' THEN NOW() - interval '55 minutes' ELSE NULL END)
           ON CONFLICT (execution_id) DO NOTHING`,
          [execution_id, input_type, input_data, status, subtask_count, total_latency_ms],
        );
      }
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  }

  await ensureTables();

  // ?action=live_mapping — return real model assignments from live Ollama
  const { searchParams } = new URL(req.url);
  if (searchParams.get('action') === 'live_mapping') {
    const mapping = await getTaskModelMapping();
    return Response.json({ live_mapping: mapping, generated_at: new Date().toISOString() });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [mappingsResult, executionsResult, modelsResult, agentsResult] = await Promise.all([
      client.query('SELECT * FROM atm_task_mappings WHERE is_active = true ORDER BY input_type, id'),
      client.query('SELECT * FROM atm_executions ORDER BY started_at DESC LIMIT 50'),
      client.query('SELECT * FROM atm_models ORDER BY status DESC, model_name ASC'),
      client.query('SELECT * FROM atm_agents ORDER BY active_tasks DESC, agent_name ASC'),
    ]);

    return Response.json({
      mappings: mappingsResult.rows,
      executions: executionsResult.rows,
      models: modelsResult.rows,
      agents: agentsResult.rows,
      generated_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  }

  await ensureTables();

  const body = await req.json().catch(() => null) as {
    action?: string;
    input_type?: string;
    input_data?: string;
    task_type?: string;
    prompt?: string;
  } | null;

  if (!body) {
    return Response.json({ error: 'Request body required' }, { status: 400 });
  }

  // action=execute: dispatch real Ollama task and record result
  if (body.action === 'execute') {
    const { task_type, prompt } = body;
    if (!task_type || !prompt) {
      return Response.json({ error: 'task_type and prompt are required for execute' }, { status: 400 });
    }

    const result = await dispatchToOllama(task_type as OllamaTaskType, prompt);

    // Record execution in atm_executions
    const execution_id = `exec-ollama-${Date.now()}`;
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO atm_executions
           (execution_id, input_type, input_data, status, subtask_count, total_latency_ms, completed_at)
         VALUES ($1, $2, $3, $4, 1, $5, NOW())`,
        [
          execution_id,
          task_type,
          prompt,
          result.status === 'completed' ? 'completed' : 'failed',
          result.latency_ms,
        ],
      );
    } finally {
      client.release();
    }

    return Response.json({
      execution_id,
      dispatch_result: result,
    }, { status: 201 });
  }

  // Default: create a simulated execution record
  if (!body.input_type) {
    return Response.json({ error: 'input_type is required' }, { status: 400 });
  }

  const { input_type, input_data } = body;
  const execution_id = `exec-${Date.now()}`;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const mappings = await client.query(
      'SELECT COUNT(*) FROM atm_task_mappings WHERE input_type = $1 AND is_active = true',
      [input_type],
    );
    const subtask_count = parseInt(mappings.rows[0].count);

    const result = await client.query(
      `INSERT INTO atm_executions (execution_id, input_type, input_data, status, subtask_count, total_latency_ms)
       VALUES ($1, $2, $3, 'running', $4, 0)
       RETURNING *`,
      [execution_id, input_type, input_data ?? null, subtask_count],
    );

    return Response.json({ execution: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.execution_id || !body.status) {
    return Response.json({ error: 'execution_id and status are required' }, { status: 400 });
  }

  const { execution_id, status, total_latency_ms } = body;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE atm_executions
       SET status = $1,
           total_latency_ms = COALESCE($2, total_latency_ms),
           completed_at = CASE WHEN $1 IN ('completed','failed') THEN NOW() ELSE NULL END
       WHERE execution_id = $3
       RETURNING *`,
      [status, total_latency_ms ?? null, execution_id],
    );

    if (result.rowCount === 0) {
      return Response.json({ error: 'Execution not found' }, { status: 404 });
    }

    return Response.json({ execution: result.rows[0] });
  } finally {
    client.release();
  }
}
