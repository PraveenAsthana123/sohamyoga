export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_ai_checks (
        id SERIAL PRIMARY KEY,
        regulation TEXT,
        check_name TEXT,
        status TEXT DEFAULT 'compliant',
        evidence TEXT,
        last_checked DATE DEFAULT CURRENT_DATE,
        risk_level TEXT DEFAULT 'low',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_ai_incidents (
        id SERIAL PRIMARY KEY,
        regulation TEXT,
        description TEXT,
        severity TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'open',
        remediation TEXT,
        detected_at DATE DEFAULT CURRENT_DATE,
        resolved_at DATE
      )
    `);

    const { rows: existing } = await client.query('SELECT COUNT(*)::int AS c FROM compliance_ai_checks');
    if (existing[0].c === 0) {
      await client.query(`INSERT INTO compliance_ai_checks (regulation, check_name, status, evidence, risk_level) VALUES
        ('GDPR', 'Data Subject Rights (Article 15-22)', 'compliant', 'User portal supports data export/deletion requests', 'low'),
        ('GDPR', 'Privacy by Design (Article 25)', 'compliant', 'PII masking implemented in AI outputs', 'low'),
        ('GDPR', 'Data Processing Agreement', 'partial', 'DPA exists but needs annual review', 'medium'),
        ('GDPR', 'Breach Notification (72hr)', 'compliant', 'Incident response plan documented', 'low'),
        ('GDPR', 'Consent Management', 'partial', 'Cookie consent implemented; email consent audit needed', 'medium'),
        ('PIPEDA', 'Purpose Limitation', 'compliant', 'Data use is limited to stated purposes', 'low'),
        ('PIPEDA', 'Individual Access Requests', 'compliant', 'Admin panel supports data access requests', 'low'),
        ('PIPEDA', 'Cross-border Data Transfer', 'partial', 'Some cloud services need BCR review', 'medium'),
        ('PIPEDA', 'Data Minimization', 'compliant', 'Forms collect only required fields', 'low'),
        ('HIPAA', 'AI Output PHI Protection', 'compliant', 'PII scanner covers health data patterns', 'low'),
        ('HIPAA', 'Access Controls', 'compliant', 'Role-based access implemented', 'low'),
        ('HIPAA', 'Audit Logging', 'partial', 'API logs exist; UI action logs need work', 'medium'),
        ('HIPAA', 'Encryption at Rest', 'non_compliant', 'Database encryption not yet configured', 'high'),
        ('SOC2', 'Availability Monitoring', 'compliant', 'Pipeline CT monitors all 12 jobs', 'low'),
        ('SOC2', 'Change Management', 'partial', 'Git-based but no formal CAB process', 'medium'),
        ('SOC2', 'Vendor Risk Management', 'partial', 'Vendor list exists; assessments incomplete', 'medium'),
        ('SOC2', 'Incident Response', 'compliant', 'Documented IR runbook exists', 'low'),
        ('WCAG', 'Level AA Color Contrast', 'compliant', 'UI uses accessible color palette', 'low'),
        ('WCAG', 'Screen Reader Compatibility', 'partial', 'Main pages tested; admin pages need audit', 'medium'),
        ('WCAG', 'Keyboard Navigation', 'partial', 'Basic keyboard nav works; modals need improvement', 'medium')`);

      await client.query(`INSERT INTO compliance_ai_incidents (regulation, description, severity, status, remediation, detected_at) VALUES
        ('HIPAA', 'Database encryption not configured for production', 'high', 'open', 'Enable TDE or application-level encryption', CURRENT_DATE - 7),
        ('GDPR', 'Email consent audit overdue — last done 14 months ago', 'medium', 'open', 'Run consent audit and re-confirm opt-ins', CURRENT_DATE - 3)`);
    }

    const [checksRes, incidentsRes] = await Promise.all([
      client.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'compliant')::int AS compliant,
          COUNT(*) FILTER (WHERE status = 'partial')::int AS partial,
          COUNT(*) FILTER (WHERE status = 'non_compliant')::int AS non_compliant,
          array_agg(DISTINCT regulation) AS regulations
        FROM compliance_ai_checks
      `).catch(() => ({ rows: [{ total: 0, compliant: 0, partial: 0, non_compliant: 0, regulations: [] }] })),
      client.query(`SELECT COUNT(*) FILTER (WHERE status='open')::int AS open FROM compliance_ai_incidents`).catch(() => ({ rows: [{ open: 0 }] })),
    ]);

    const st = checksRes.rows[0];
    const total = parseInt(st.total) || 1;
    const compliant = parseInt(st.compliant) || 0;
    const complianceScore = Math.round((compliant / total) * 100);
    const openIncidents = incidentsRes.rows[0].open;

    const health_score = Math.min(100,
      Math.round((compliant / total) * 60) +
      (openIncidents === 0 ? 40 : openIncidents === 1 ? 25 : openIncidents <= 3 ? 15 : 5)
    );

    return Response.json({
      health_score,
      traffic_light: health_score >= 80 ? 'green' : health_score >= 60 ? 'yellow' : 'red',
      compliance_score: complianceScore,
      open_incidents: openIncidents,
      regulations_covered: (st.regulations ?? []).filter(Boolean).length,
      checks: st,
      kpis: [
        { label: 'Compliance Score', value: complianceScore, target: 100, trend: complianceScore >= 90 ? 'up' : 'down', unit: '%' },
        { label: 'Compliant Checks', value: compliant, target: total, trend: compliant >= total ? 'up' : 'down', unit: `/${total}` },
        { label: 'Non-Compliant', value: st.non_compliant, target: 0, trend: st.non_compliant === 0 ? 'up' : 'down', unit: 'checks' },
        { label: 'Open Incidents', value: openIncidents, target: 0, trend: openIncidents === 0 ? 'up' : 'down', unit: 'incidents' },
      ],
      updated_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}
