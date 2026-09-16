export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS ai_transformation_roadmap (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      initiative_name TEXT NOT NULL,
      phase TEXT DEFAULT 'foundation',
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'planned',
      owner TEXT,
      start_date DATE,
      end_date DATE,
      business_value TEXT,
      ai_capability TEXT,
      data_required TEXT,
      model_type TEXT,
      deployment TEXT,
      estimated_roi_pct NUMERIC(6,2),
      risk_level TEXT DEFAULT 'medium',
      dependencies TEXT[],
      success_metrics TEXT[],
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_model_registry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      model_name TEXT NOT NULL,
      model_type TEXT,
      framework TEXT,
      version TEXT,
      status TEXT DEFAULT 'active',
      deployment_env TEXT DEFAULT 'local',
      endpoint_url TEXT,
      use_case TEXT,
      owner TEXT,
      last_updated_at TIMESTAMPTZ DEFAULT NOW(),
      performance_metrics_json JSONB DEFAULT '{}',
      explainability_method TEXT,
      bias_tested BOOLEAN DEFAULT false,
      fairness_score NUMERIC(4,3),
      carbon_footprint_kg NUMERIC(8,4),
      cost_per_1k_calls NUMERIC(8,4),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS responsible_ai_assessments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      model_id UUID REFERENCES ai_model_registry(id),
      assessment_type TEXT,
      score INT,
      findings TEXT,
      risk_level TEXT,
      mitigations TEXT[],
      reviewer TEXT,
      reviewed_at TIMESTAMPTZ DEFAULT NOW(),
      next_review_date DATE
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_operating_model (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dimension TEXT NOT NULL,
      current_state TEXT,
      target_state TEXT,
      gap TEXT,
      actions TEXT[],
      owner TEXT,
      maturity_level INT DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await seedIfEmpty();
}

async function seedIfEmpty() {
  const { rows: rd } = await query(`SELECT COUNT(*)::int AS cnt FROM ai_transformation_roadmap`);
  if (rd[0].cnt === 0) {
    await query(`
      INSERT INTO ai_transformation_roadmap
        (initiative_name, phase, priority, status, owner, start_date, end_date, business_value, ai_capability, data_required, model_type, deployment, estimated_roi_pct, risk_level, success_metrics, notes)
      VALUES
        ('Data Quality & Governance Foundation', 'foundation', 'critical', 'in_progress', 'CTO', '2026-01-01', '2026-03-31', 'Enable AI-ready data pipelines', 'automation', 'CRM, transactional DB', 'supervised', 'hybrid', 15.00, 'medium', ARRAY['Data completeness >95%','Latency <200ms'], 'Core blocker for all other AI initiatives'),
        ('AI Talent Upskilling Program', 'foundation', 'high', 'in_progress', 'HR Director', '2026-01-15', '2026-04-30', 'Build internal AI competency', 'nlp', 'Employee profiles, learning data', 'llm', 'cloud', 10.00, 'low', ARRAY['50 employees certified','NPS >40'], 'Partner with Coursera Enterprise'),
        ('Customer Churn Prediction Pilot', 'pilot', 'critical', 'planned', 'Head of Analytics', '2026-04-01', '2026-06-30', 'Reduce churn by 20% in 6 months', 'prediction', 'Customer behavior logs, billing data', 'supervised', 'cloud', 35.00, 'medium', ARRAY['AUC >0.85','Churn reduction 15%+'], 'Use XGBoost + SHAP explanations'),
        ('Personalised Content Recommendation Engine', 'pilot', 'high', 'planned', 'Product Lead', '2026-04-15', '2026-07-15', 'Increase engagement by 30%', 'recommendation', 'User activity, content metadata', 'unsupervised', 'hybrid', 28.00, 'medium', ARRAY['CTR +25%','Session length +15%'], 'Collaborative + content-based hybrid'),
        ('Automated Document Processing', 'pilot', 'medium', 'planned', 'Operations Manager', '2026-05-01', '2026-07-31', 'Save 500 hours/month in manual processing', 'automation', 'Invoices, contracts, forms', 'cv', 'on_premise', 42.00, 'low', ARRAY['Accuracy >92%','Processing time -80%'], 'OCR + NLP pipeline with Ollama'),
        ('Real-Time Fraud Detection System', 'scale', 'critical', 'planned', 'CISO', '2026-07-01', '2026-09-30', 'Prevent fraud losses >$500k/yr', 'prediction', 'Transaction streams, device fingerprints', 'supervised', 'cloud', 65.00, 'high', ARRAY['False positive <1%','Latency <50ms'], 'Streaming ML with Kafka + model serving'),
        ('AI-Powered Marketing Copywriting', 'scale', 'high', 'planned', 'CMO', '2026-07-15', '2026-10-15', 'Cut content creation cost by 60%', 'generation', 'Brand guidelines, past campaigns', 'llm', 'hybrid', 55.00, 'low', ARRAY['Content output 5x','Quality score >80'], 'Ollama llama3.2 fine-tuned on brand voice'),
        ('Predictive Inventory Optimisation', 'optimize', 'high', 'planned', 'Supply Chain Lead', '2026-10-01', '2026-12-31', 'Reduce inventory holding costs 25%', 'optimization', 'Sales history, supplier data, demand signals', 'supervised', 'cloud', 32.00, 'medium', ARRAY['Stockout rate -50%','Carrying cost -20%'], 'ARIMA + ML ensemble approach'),
        ('Autonomous Customer Service Agent', 'optimize', 'medium', 'planned', 'CX Director', '2026-10-15', '2027-01-15', 'Handle 70% of queries without human escalation', 'nlp', 'Support tickets, knowledge base, product docs', 'llm', 'hybrid', 48.00, 'medium', ARRAY['Resolution rate 70%','CSAT >4.2/5'], 'RAG-powered agent with Ollama + vector DB'),
        ('AI R&D Innovation Lab', 'innovate', 'medium', 'planned', 'Chief AI Officer', '2027-01-01', '2027-06-30', 'Build competitive moat with proprietary models', 'generation', 'Proprietary datasets, domain knowledge', 'multimodal', 'hybrid', 80.00, 'high', ARRAY['2 patent applications','3 published papers'], 'Foundation model fine-tuning + edge deployment')
    `);
  }

  const { rows: rm } = await query(`SELECT COUNT(*)::int AS cnt FROM ai_model_registry`);
  if (rm[0].cnt === 0) {
    await query(`
      INSERT INTO ai_model_registry
        (model_name, model_type, framework, version, status, deployment_env, endpoint_url, use_case, owner, performance_metrics_json, explainability_method, bias_tested, fairness_score, carbon_footprint_kg, cost_per_1k_calls)
      VALUES
        ('llama3.2:3b', 'llm', 'ollama', '3.2', 'active', 'local', 'http://localhost:11434', 'General text generation, summarization, Q&A', 'Platform Team', '{"latency_ms":1200,"throughput":8,"accuracy":0.82}', 'attention_viz', true, 0.891, 0.0012, 0.0000),
        ('qwen2.5:latest', 'llm', 'ollama', '2.5', 'active', 'local', 'http://localhost:11434', 'Marketing copy generation, content creation', 'AI Team', '{"latency_ms":800,"throughput":12,"accuracy":0.87}', 'attention_viz', true, 0.876, 0.0009, 0.0000),
        ('phi4-mini:latest', 'llm', 'ollama', '4-mini', 'active', 'local', 'http://localhost:11434', 'Fast classification, intent detection', 'Platform Team', '{"latency_ms":200,"throughput":45,"accuracy":0.79}', 'lime', false, null, 0.0002, 0.0000),
        ('qwen2.5-coder:latest', 'nlp', 'ollama', '2.5', 'active', 'local', 'http://localhost:11434', 'Code generation, technical documentation', 'Engineering', '{"latency_ms":600,"throughput":18,"accuracy":0.91}', 'attention_viz', false, null, 0.0007, 0.0000),
        ('gpt-4o-placeholder', 'llm', 'openai', 'gpt-4o', 'testing', 'cloud_aws', 'https://api.openai.com/v1', 'Complex reasoning, multimodal analysis (evaluation only)', 'AI Team', '{"latency_ms":2200,"throughput":4,"accuracy":0.95,"f1_score":0.94}', 'none', true, 0.950, 8.2000, 5.0000),
        ('customer-churn-xgb', 'classification', 'sklearn', '1.3.0', 'testing', 'cloud_aws', 'http://ml-serving:8080/churn', 'Customer churn prediction', 'Analytics Team', '{"accuracy":0.884,"f1_score":0.871,"latency_ms":45,"throughput":2200}', 'shap', true, 0.823, 0.0001, 0.0020),
        ('content-recommender-cf', 'recommendation', 'pytorch', '2.1', 'active', 'hybrid', 'http://ml-serving:8080/recommend', 'Personalised content and product recommendations', 'Product Team', '{"accuracy":0.791,"latency_ms":38,"throughput":1800}', 'integrated_gradients', false, null, 0.0003, 0.0015),
        ('doc-ocr-vision', 'cv', 'tensorflow', '2.14', 'active', 'on_premise', 'http://ocr-service:8080', 'Invoice and document OCR and classification', 'Operations', '{"accuracy":0.923,"latency_ms":320,"throughput":180}', 'grad_cam', true, 0.901, 0.0050, 0.0050)
    `);
  }

  const { rows: ra } = await query(`SELECT COUNT(*)::int AS cnt FROM responsible_ai_assessments`);
  if (ra[0].cnt === 0) {
    const { rows: models } = await query(`SELECT id, model_name FROM ai_model_registry ORDER BY created_at LIMIT 5`);
    if (models.length >= 5) {
      await query(`
        INSERT INTO responsible_ai_assessments (model_id, assessment_type, score, findings, risk_level, mitigations, reviewer, next_review_date)
        VALUES
          ($1, 'bias', 82, 'Minor demographic bias detected in training data — gender representation skewed 70/30. Output shows slight preference for certain communication styles.', 'medium', ARRAY['Rebalance training data','Implement fairness constraints','Regular audits quarterly'], 'AI Ethics Officer', '2026-12-01'),
          ($2, 'transparency', 91, 'Model uses attention visualization providing good interpretability. Decision paths traceable for 89% of queries. Some edge cases opaque.', 'low', ARRAY['Expand attention logging','Add user-facing explanations','Publish model card'], 'AI Ethics Officer', '2026-12-01'),
          ($3, 'fairness', 74, 'Performance gap between demographic groups: accuracy varies 8% between age cohorts 18-35 vs 55+. Requires retraining with age-balanced dataset.', 'medium', ARRAY['Collect age-balanced data','Apply fairness regularization','Deploy A/B testing per segment'], 'ML Engineer', '2026-11-01'),
          ($4, 'privacy', 88, 'Model does not store PII in weights. Data minimization practices implemented. GDPR Article 22 automated decision safeguards documented.', 'low', ARRAY['Annual privacy audit','Implement differential privacy','Add data retention TTLs'], 'Privacy Officer', '2027-01-01'),
          ($5, 'safety', 69, 'Model can generate factually incorrect content (hallucination rate 11%). No harmful content guardrails beyond OpenAI policy. Human review required for high-stakes outputs.', 'high', ARRAY['Add hallucination detection layer','Implement output validation','Require human approval for critical decisions','Red-team quarterly'], 'AI Safety Reviewer', '2026-10-01')
      `, [models[0].id, models[1].id, models[2].id, models[3].id, models[4].id]);
    }
  }

  const { rows: ro } = await query(`SELECT COUNT(*)::int AS cnt FROM ai_operating_model`);
  if (ro[0].cnt === 0) {
    await query(`
      INSERT INTO ai_operating_model (dimension, current_state, target_state, gap, actions, owner, maturity_level)
      VALUES
        ('governance', 'Ad-hoc AI decisions with no formal oversight. No AI steering committee. Policies documented inconsistently.', 'Formal AI governance board meeting monthly. Clear decision rights. Documented AI policy framework with enforcement.', 'Missing governance structure and enforcement mechanisms', ARRAY['Establish AI Steering Committee','Draft AI Policy Framework','Define RACI for AI decisions','Implement AI risk register'], 'CTO', 3),
        ('talent', 'Small team of 3 ML engineers. No dedicated AI product managers. Limited prompt engineering skills across teams.', 'AI Centre of Excellence with 15+ specialists. All product teams AI-literate. Dedicated AI PMs and ethicists.', 'Significant talent gap especially in AI product management and ethics', ARRAY['Hire 2 senior ML engineers','Launch AI literacy program for all staff','Partner with universities for talent pipeline','Create AI career ladder'], 'CHRO', 2),
        ('data', 'Data silos across 6 systems. No unified data platform. Quality issues in 40% of datasets. No real-time pipelines.', 'Unified data mesh with real-time streaming. Data catalog with lineage. Quality SLAs >99%. Self-serve analytics.', 'Data integration and quality are blockers for ML model reliability', ARRAY['Implement data catalog','Build ETL pipelines for key sources','Establish data quality SLAs','Deploy feature store'], 'Head of Data', 3),
        ('infrastructure', 'Local Ollama for dev/test. Cloud ad-hoc via personal accounts. No MLOps platform. Manual deployments.', 'Production MLOps platform on hybrid cloud. Automated CI/CD for models. Monitoring and drift detection. Cost controls.', 'No production-grade ML infrastructure or MLOps practices', ARRAY['Deploy Kubeflow or MLflow','Implement model monitoring','Establish GPU cluster policy','Build model serving layer'], 'Head of Infrastructure', 4),
        ('process', 'ML projects run like software projects. No ML-specific workflows. Experiments not tracked. No model documentation standards.', 'Standardised ML project lifecycle from ideation to decommission. Experiment tracking. Model registry. Change management.', 'Lack of ML-native processes creates inconsistency and rework', ARRAY['Adopt ML project template','Deploy MLflow experiment tracking','Create model documentation standard','Implement model review gates'], 'Head of Engineering', 3),
        ('culture', 'AI seen as IT initiative. Business teams skeptical. Few cross-functional collaborations. Data-driven decisions inconsistent.', 'AI-first culture where every function uses data and AI daily. Psychological safety for experimentation. Failure celebrated as learning.', 'Cultural resistance and low AI adoption outside tech teams', ARRAY['CEO AI vision communication','AI champions program per department','Monthly AI wins showcase','AI hackathons quarterly'], 'CEO', 2),
        ('ethics', 'Ethics considered reactively. No formal AI ethics review process. No external ethics board. Limited bias testing.', 'Proactive ethics-by-design framework. External ethics advisory board. Mandatory bias testing before deployment. Public AI commitments.', 'Ethics as afterthought creates regulatory and reputational risk', ARRAY['Create Ethics Review Board','Publish Responsible AI Principles','Mandate bias testing in model pipeline','Appoint Chief AI Ethics Officer'], 'General Counsel', 4)
    `);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  try {
    await ensureSchema();

    const [roadmap, models, assessments, operatingModel] = await Promise.all([
      query(`SELECT * FROM ai_transformation_roadmap ORDER BY phase, priority DESC, created_at`),
      query(`SELECT * FROM ai_model_registry ORDER BY status, model_name`),
      query(`
        SELECT ra.*, mr.model_name
        FROM responsible_ai_assessments ra
        LEFT JOIN ai_model_registry mr ON mr.id = ra.model_id
        ORDER BY ra.reviewed_at DESC
      `),
      query(`SELECT * FROM ai_operating_model ORDER BY dimension`),
    ]);

    const avgMaturity = operatingModel.rows.length
      ? (operatingModel.rows.reduce((s, r) => s + (r.maturity_level ?? 1), 0) / operatingModel.rows.length).toFixed(1)
      : '1.0';
    const avgRaiScore = assessments.rows.length
      ? Math.round(assessments.rows.reduce((s, r) => s + (r.score ?? 0), 0) / assessments.rows.length)
      : 0;
    const totalCarbon = models.rows.reduce((s, r) => s + parseFloat(r.carbon_footprint_kg ?? '0'), 0);
    const openRisks = assessments.rows.filter(r => ['high', 'critical'].includes(r.risk_level)).length;
    const assessmentsDue = models.rows.filter(r => !r.bias_tested).length;

    return Response.json({
      roadmap: roadmap.rows,
      models: models.rows,
      assessments: assessments.rows,
      operatingModel: operatingModel.rows,
      kpi: {
        roadmapCount: roadmap.rows.length,
        activeModels: models.rows.filter(r => r.status === 'active').length,
        assessmentsDue,
        avgRaiScore,
        totalCarbonKg: parseFloat(totalCarbon.toFixed(4)),
        openRisks,
        avgMaturity: parseFloat(avgMaturity),
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
