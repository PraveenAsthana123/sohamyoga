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
      CREATE TABLE IF NOT EXISTS ait_models (
        model_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        provider VARCHAR(64) NOT NULL,
        model_type VARCHAR(32) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'serving',
        version VARCHAR(32) NOT NULL DEFAULT '1.0',
        calls_today INT NOT NULL DEFAULT 0,
        avg_latency_ms INT NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS ait_inferences (
        id SERIAL PRIMARY KEY,
        call_id VARCHAR(64) NOT NULL,
        model_id VARCHAR(64),
        prompt_preview VARCHAR(100),
        latency_ms INT,
        tokens_used INT,
        cost_usd NUMERIC(8,5),
        status VARCHAR(32) NOT NULL DEFAULT 'success',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ait_prompts (
        prompt_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        model_id VARCHAR(64),
        template TEXT NOT NULL,
        version VARCHAR(16) NOT NULL DEFAULT 'v1.0',
        last_updated TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ait_experiments (
        exp_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        model_a VARCHAR(64) NOT NULL,
        model_b VARCHAR(64) NOT NULL,
        metric VARCHAR(64) NOT NULL,
        winner VARCHAR(64),
        sample_size INT NOT NULL DEFAULT 0,
        started_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ait_guardrails (
        rule_id VARCHAR(64) PRIMARY KEY,
        rule_name VARCHAR(128) NOT NULL,
        rule_type VARCHAR(64) NOT NULL,
        threshold_value NUMERIC,
        is_active BOOLEAN NOT NULL DEFAULT true
      );
    `);

    const { rows: m } = await client.query('SELECT COUNT(*) FROM ait_models');
    if (parseInt(m[0].count) === 0) {
      const models = [
        ['mdl-llama3', 'Llama 3.1 70B', 'Ollama', 'LLM', 'serving', 'v3.1', 1842, 980],
        ['mdl-mistral', 'Mistral 7B', 'Ollama', 'LLM', 'serving', 'v0.3', 763, 420],
        ['mdl-gpt4o', 'GPT-4o', 'OpenAI', 'LLM', 'serving', '2024-08', 312, 1240],
        ['mdl-claude3', 'Claude 3.5 Sonnet', 'Anthropic', 'LLM', 'serving', '2024-06', 204, 1100],
        ['mdl-embed', 'text-embedding-3-small', 'OpenAI', 'Embedding', 'serving', 'v3', 5420, 90],
        ['mdl-nomic', 'nomic-embed-text', 'Ollama', 'Embedding', 'serving', 'v1.5', 2310, 45],
        ['mdl-llava', 'LLaVA 1.6', 'Ollama', 'Vision', 'loading', 'v1.6', 12, 2300],
        ['mdl-whisper', 'Whisper v3', 'OpenAI', 'Audio', 'deprecated', 'v3', 0, 0],
      ];
      for (const [id, name, provider, type, status, version, calls, lat] of models) {
        await client.query(
          'INSERT INTO ait_models (model_id,name,provider,model_type,status,version,calls_today,avg_latency_ms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [id, name, provider, type, status, version, calls, lat]
        );
      }
    }

    const { rows: inf } = await client.query('SELECT COUNT(*) FROM ait_inferences');
    if (parseInt(inf[0].count) === 0) {
      const inferences = [
        ['call-001', 'mdl-llama3', 'Generate a social media post for yoga...', 1120, 512, 0.00450, 'success'],
        ['call-002', 'mdl-gpt4o', 'Summarize the competitor analysis rep...', 1580, 1024, 0.01230, 'success'],
        ['call-003', 'mdl-embed', 'User onboarding flow documentation...', 88, 256, 0.00004, 'success'],
        ['call-004', 'mdl-claude3', 'Write SEO meta description for yoga c...', 1340, 400, 0.00900, 'success'],
        ['call-005', 'mdl-mistral', 'Classify customer support ticket: acc...', 380, 128, 0.00020, 'success'],
        ['call-006', 'mdl-llama3', 'Draft email campaign for new product l...', 1050, 600, 0.00500, 'success'],
        ['call-007', 'mdl-gpt4o', 'Extract key metrics from uploaded CSV...', 2100, 2048, 0.02460, 'error'],
        ['call-008', 'mdl-nomic', 'Blog post about mindfulness techniques...', 42, 192, 0.00001, 'success'],
        ['call-009', 'mdl-llama3', 'Translate product description to Frenc...', 920, 480, 0.00380, 'success'],
        ['call-010', 'mdl-claude3', 'Review landing page copy and suggest i...', 1190, 720, 0.01260, 'success'],
        ['call-011', 'mdl-mistral', 'Detect sentiment: customer review batc...', 420, 256, 0.00025, 'success'],
        ['call-012', 'mdl-embed', 'FAQ knowledge base article chunk 47...', 65, 128, 0.00002, 'success'],
        ['call-013', 'mdl-llama3', 'Summarize 3000 word blog post to 150...', 880, 400, 0.00320, 'success'],
        ['call-014', 'mdl-gpt4o', 'Generate A/B test variants for CTA but...', 1780, 900, 0.01080, 'success'],
        ['call-015', 'mdl-llava', 'Describe product image for alt text ge...', 2450, 300, 0.00500, 'success'],
        ['call-016', 'mdl-llama3', 'Create FAQ responses for membership ti...', 1100, 550, 0.00440, 'error'],
        ['call-017', 'mdl-claude3', 'Analyze competitor pricing page and su...', 1420, 800, 0.01400, 'success'],
        ['call-018', 'mdl-embed', 'Yoga class schedule April–June 2026...', 55, 96, 0.00001, 'success'],
        ['call-019', 'mdl-mistral', 'Generate 10 Instagram caption ideas fo...', 360, 200, 0.00018, 'success'],
        ['call-020', 'mdl-llama3', 'Draft partnership outreach email to loc...', 940, 480, 0.00380, 'success'],
      ];
      for (const [cid, mid, preview, lat, tokens, cost, status] of inferences) {
        await client.query(
          'INSERT INTO ait_inferences (call_id,model_id,prompt_preview,latency_ms,tokens_used,cost_usd,status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [cid, mid, preview, lat, tokens, cost, status]
        );
      }
    }

    const { rows: pr } = await client.query('SELECT COUNT(*) FROM ait_prompts');
    if (parseInt(pr[0].count) === 0) {
      const prompts = [
        ['prm-soc-post', 'Social Media Post Generator', 'mdl-llama3', 'You are an expert social media manager. Generate a {{platform}} post about {{topic}} for a {{brand_type}} brand. Tone: {{tone}}. Max {{chars}} characters. Include relevant hashtags. Output only the post text.', 'v2.1'],
        ['prm-seo-meta', 'SEO Meta Description Writer', 'mdl-claude3', 'Write an SEO-optimized meta description for the following page:\nTitle: {{page_title}}\nContent summary: {{content_summary}}\n\nRequirements:\n- 150-160 characters\n- Include primary keyword: {{keyword}}\n- Action-oriented, compelling CTA\n- No keyword stuffing', 'v1.3'],
        ['prm-email-subj', 'Email Subject Line Generator', 'mdl-gpt4o', 'Generate 5 high-converting email subject lines for:\nCampaign: {{campaign_name}}\nOffer: {{offer_description}}\nAudience: {{audience_segment}}\n\nReturn as JSON array of strings. Each under 60 chars.', 'v1.0'],
        ['prm-sentiment', 'Customer Sentiment Classifier', 'mdl-mistral', 'Classify the sentiment of the following customer feedback. Return JSON: {"sentiment": "positive|negative|neutral", "confidence": 0.0-1.0, "key_theme": "string"}\n\nFeedback: {{feedback_text}}', 'v3.0'],
        ['prm-blog-outline', 'Blog Post Outline Creator', 'mdl-llama3', 'Create a detailed SEO-optimized blog post outline for:\nTopic: {{topic}}\nTarget keyword: {{keyword}}\nAudience: {{audience}}\nWord count target: {{word_count}}\n\nInclude: H1 title, meta description, H2 sections with H3 subsections, FAQ section, conclusion CTA.', 'v2.0'],
        ['prm-rag-qa', 'RAG Q&A System Prompt', 'mdl-llama3', 'You are a knowledgeable assistant for {{brand_name}}. Answer questions based ONLY on the provided context.\n\nContext:\n{{retrieved_context}}\n\nIf the context does not contain enough information, say "I don\'t have enough information about that." Do not make up facts.\n\nQuestion: {{user_question}}', 'v1.5'],
      ];
      for (const [id, name, mid, template, version] of prompts) {
        await client.query(
          'INSERT INTO ait_prompts (prompt_id,name,model_id,template,version) VALUES ($1,$2,$3,$4,$5)',
          [id, name, mid, template, version]
        );
      }
    }

    const { rows: ex } = await client.query('SELECT COUNT(*) FROM ait_experiments');
    if (parseInt(ex[0].count) === 0) {
      const experiments = [
        ['exp-latency-01', 'Llama vs Mistral for Classification', 'mdl-llama3', 'mdl-mistral', 'latency_ms', 'mdl-mistral', 500],
        ['exp-quality-01', 'GPT-4o vs Claude for SEO Content', 'mdl-gpt4o', 'mdl-claude3', 'quality_score', null, 120],
        ['exp-cost-01', 'nomic vs text-embedding-3-small', 'mdl-nomic', 'mdl-embed', 'cost_per_1k_tokens', 'mdl-nomic', 1000],
      ];
      for (const [id, name, ma, mb, metric, winner, sample] of experiments) {
        await client.query(
          'INSERT INTO ait_experiments (exp_id,name,model_a,model_b,metric,winner,sample_size) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [id, name, ma, mb, metric, winner, sample]
        );
      }
    }

    const { rows: gr } = await client.query('SELECT COUNT(*) FROM ait_guardrails');
    if (parseInt(gr[0].count) === 0) {
      const guardrails = [
        ['gr-content', 'Content Safety Filter', 'content_filter', 0.85, true],
        ['gr-rate', 'Inference Rate Limiter', 'rate_limit', 100, true],
        ['gr-cost', 'Daily Cost Cap', 'cost_cap', 50.00, true],
        ['gr-tokens', 'Max Token Limit', 'token_limit', 4096, true],
        ['gr-pii', 'PII Redaction', 'pii_redaction', null, false],
      ];
      for (const [id, name, type, threshold, active] of guardrails) {
        await client.query(
          'INSERT INTO ait_guardrails (rule_id,rule_name,rule_type,threshold_value,is_active) VALUES ($1,$2,$3,$4,$5)',
          [id, name, type, threshold, active]
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
  try {
    await ensureTables();
    const pool = getPool();
    const [models, inferences, prompts, experiments, guardrails] = await Promise.all([
      pool.query('SELECT * FROM ait_models ORDER BY calls_today DESC'),
      pool.query('SELECT * FROM ait_inferences ORDER BY created_at DESC LIMIT 20'),
      pool.query('SELECT * FROM ait_prompts ORDER BY name'),
      pool.query('SELECT * FROM ait_experiments ORDER BY started_at DESC'),
      pool.query('SELECT * FROM ait_guardrails ORDER BY rule_name'),
    ]);
    const deployed = models.rows.filter(m => m.status === 'serving').length;
    const totalCalls = models.rows.reduce((s: number, m: { calls_today: number }) => s + m.calls_today, 0);
    const avgLatency = models.rows.filter((m: { avg_latency_ms: number }) => m.avg_latency_ms > 0).reduce((s: number, m: { avg_latency_ms: number }, _: number, arr: { avg_latency_ms: number }[]) => s + m.avg_latency_ms / arr.length, 0);
    const errorRate = inferences.rows.length
      ? (inferences.rows.filter((i: { status: string }) => i.status === 'error').length / inferences.rows.length * 100).toFixed(1) : '0';
    return NextResponse.json({
      stats: { deployed, totalCalls, avgLatency: Math.round(avgLatency), errorRate: parseFloat(errorRate) },
      models: models.rows, inferences: inferences.rows, prompts: prompts.rows,
      experiments: experiments.rows, guardrails: guardrails.rows,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const body = await req.json() as { call_id: string; model_id: string; prompt_preview: string; latency_ms: number; tokens_used: number; cost_usd: number; status: string };
    const pool = getPool();
    const { rows } = await pool.query(
      'INSERT INTO ait_inferences (call_id,model_id,prompt_preview,latency_ms,tokens_used,cost_usd,status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [body.call_id, body.model_id, body.prompt_preview, body.latency_ms, body.tokens_used, body.cost_usd, body.status]
    );
    return NextResponse.json({ inference: rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const body = await req.json() as { rule_id: string; is_active: boolean };
    const pool = getPool();
    const { rows } = await pool.query(
      'UPDATE ait_guardrails SET is_active=$1 WHERE rule_id=$2 RETURNING *',
      [body.is_active, body.rule_id]
    );
    return NextResponse.json({ guardrail: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
