import { NextRequest} from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_governance_log (
        id BIGSERIAL PRIMARY KEY,
        module_name VARCHAR(100),
        operation_type VARCHAR(50),
        model_used VARCHAR(100),
        input_summary TEXT,
        output_summary TEXT,
        decision_made TEXT,
        human_reviewed BOOLEAN DEFAULT false,
        human_override BOOLEAN DEFAULT false,
        override_reason TEXT,
        fairness_score DECIMAL(3,2),
        explainability_score DECIMAL(3,2),
        confidence_score DECIMAL(3,2),
        bias_flags TEXT,
        ethical_flags TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS security_config_check (
        id SERIAL PRIMARY KEY,
        check_name VARCHAR(200),
        check_category VARCHAR(50),
        status VARCHAR(20),
        severity VARCHAR(20),
        finding TEXT,
        recommendation TEXT,
        checked_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS quality_benchmark (
        id SERIAL PRIMARY KEY,
        module_name VARCHAR(100),
        dimension VARCHAR(50),
        score DECIMAL(4,1),
        max_score DECIMAL(4,1) DEFAULT 100.0,
        evidence TEXT,
        benchmark_method VARCHAR(50),
        assessed_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(module_name, dimension)
      )
    `);

    // Seed 50 governance logs
    const modules = ['social-scheduler', 'content-ai', 'affiliate-fraud', 'churn-prediction', 'campaign-optimizer', 'email-composer', 'analytics-insight', 'lead-scoring', 'review-responder', 'seo-advisor'];
    const operations = ['content_generation', 'fraud_detection', 'sentiment_analysis', 'classification', 'summarization', 'recommendation'];

    for (let i = 0; i < 50; i++) {
      const mod = modules[i % modules.length];
      const op = operations[i % operations.length];
      const fairness = 0.6 + Math.random() * 0.4;
      const explainability = 0.5 + Math.random() * 0.5;
      const confidence = 0.55 + Math.random() * 0.45;
      const hasBiasFlag = confidence < 0.65 ? 'low_confidence' : '';
      const hasEthicalFlag = fairness < 0.65 ? 'fairness_concern' : '';

      await pool.query(
        `INSERT INTO ai_governance_log
         (module_name, operation_type, model_used, input_summary, output_summary, decision_made,
          fairness_score, explainability_score, confidence_score, bias_flags, ethical_flags, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()-($12 || ' hours')::INTERVAL)`,
        [mod, op, 'llama3.2', `${op} input for ${mod}`, `AI-generated output for ${mod}`, 'Auto-approved',
         fairness.toFixed(2), explainability.toFixed(2), confidence.toFixed(2),
         hasBiasFlag, hasEthicalFlag, String(i * 0.5)]
      );
    }

    // Seed 20 security checks
    const checks = [
      { name: 'HTTPS enforced', category: 'transport', severity: 'critical', status: 'pass' },
      { name: 'Rate limiting configured', category: 'api', severity: 'high', status: 'pass' },
      { name: 'SQL injection prevention', category: 'database', severity: 'critical', status: 'pass' },
      { name: 'XSS protection headers', category: 'web', severity: 'high', status: 'warning' },
      { name: 'CSRF protection enabled', category: 'web', severity: 'high', status: 'pass' },
      { name: 'Secrets not in source', category: 'secrets', severity: 'critical', status: 'pass' },
      { name: 'JWT token expiry < 24h', category: 'auth', severity: 'medium', status: 'pass' },
      { name: 'Password hashing (bcrypt)', category: 'auth', severity: 'critical', status: 'pass' },
      { name: 'Admin routes protected', category: 'auth', severity: 'high', status: 'pass' },
      { name: 'DB connection uses SSL', category: 'database', severity: 'high', status: 'warning' },
      { name: 'File upload validation', category: 'input', severity: 'high', status: 'pass' },
      { name: 'No critical CVEs', category: 'supply_chain', severity: 'high', status: 'warning' },
      { name: 'CORS correctly scoped', category: 'api', severity: 'medium', status: 'pass' },
      { name: 'Error messages safe', category: 'web', severity: 'medium', status: 'pass' },
      { name: 'CSP header present', category: 'web', severity: 'medium', status: 'warning' },
      { name: 'Ollama not exposed publicly', category: 'ai', severity: 'critical', status: 'pass' },
      { name: 'AI outputs logged', category: 'ai', severity: 'medium', status: 'pass' },
      { name: 'PII fields encrypted', category: 'privacy', severity: 'high', status: 'warning' },
      { name: 'Sessions invalidated on logout', category: 'auth', severity: 'high', status: 'pass' },
      { name: 'Backup encryption enabled', category: 'data', severity: 'medium', status: 'pass' },
    ];

    for (const c of checks) {
      await pool.query(
        `INSERT INTO security_config_check (check_name, check_category, status, severity, finding)
         VALUES ($1,$2,$3,$4,$5)`,
        [c.name, c.category, c.status, c.severity, c.status === 'pass' ? 'Check passed.' : 'Needs attention — see recommendation.']
      );
    }

    // Seed quality benchmarks for 15 modules × 6 dimensions
    const qModules = ['social', 'email', 'affiliates', 'analytics', 'ecommerce', 'crm', 'content', 'ai-governance', 'calendar', 'broadcast', 'customer-service', 'billing', 'campaigns', 'seo', 'referral'];
    const dimensions = ['performance', 'reliability', 'security', 'usability', 'coverage', 'accuracy'];

    for (const mod of qModules) {
      for (const dim of dimensions) {
        const score = 60 + Math.random() * 40;
        await pool.query(
          `INSERT INTO quality_benchmark (module_name, dimension, score, evidence, benchmark_method)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (module_name, dimension) DO NOTHING`,
          [mod, dim, score.toFixed(1), 'Seeded benchmark score', 'automated']
        );
      }
    }

    return Response.json({ ok: true, message: '3 tables created, 50 governance logs + 20 security checks + quality benchmarks seeded' });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
