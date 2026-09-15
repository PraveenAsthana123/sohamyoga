// CRO / Website Friction — real, admin-logged friction findings. No
// external conversion-analytics scraper is invoked here.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SEVERITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };

// Pure, unit-tested: real, disclosed readiness score -- 100 minus a
// real weighted penalty per unresolved finding, floored at 0. Never
// negative, never penalizes a resolved finding.
export function computeConversionReadinessScore(unresolvedFindings: { severity: string }[]): number {
  const penalty = unresolvedFindings.reduce((sum, f) => sum + (SEVERITY_WEIGHT[f.severity] ?? 1) * 5, 0);
  return Math.max(0, 100 - penalty);
}

export async function getCroSummary(tenantId: string) {
  const rows = await db.query<{ id: string; page_path: string; friction_type: string; severity: string; description: string; resolved_at: string | null }>(
    `SELECT id, page_path, friction_type, severity, description, resolved_at FROM cro_friction_finding WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId],
  );
  const unresolved = rows.rows.filter((r) => !r.resolved_at);
  return { findings: rows.rows, unresolvedCount: unresolved.length, conversionReadinessScore: computeConversionReadinessScore(unresolved) };
}

export async function recordFrictionFinding(tenantId: string, pagePath: string, frictionType: string, severity: string, description: string, createdBy: string) {
  const r = await db.query(
    `INSERT INTO cro_friction_finding (tenant_id, page_path, friction_type, severity, description, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [tenantId, pagePath, frictionType, severity, description, createdBy],
  );
  return r.rows[0];
}
