// Case Study Engine — real case studies, required to cite real
// evidence_ids (#1). A case study with zero cited evidence cannot be
// published -- enforced here, not just by convention.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// Pure, unit-tested: the real enforcement rule.
export function canPublish(evidenceIds: string[]): boolean {
  return evidenceIds.length > 0;
}

export async function createCaseStudy(tenantId: string, title: string, narrative: string, evidenceIds: string[], createdBy: string) {
  const r = await db.query(
    `INSERT INTO case_study (tenant_id, title, narrative, evidence_ids, status, created_by)
     VALUES ($1,$2,$3,$4,'draft',$5) RETURNING *`,
    [tenantId, title, narrative, evidenceIds, createdBy],
  );
  return r.rows[0];
}

export async function publishCaseStudy(id: string): Promise<{ ok: boolean; reason?: string }> {
  const existing = await db.query<{ evidence_ids: string[] }>(`SELECT evidence_ids FROM case_study WHERE id = $1`, [id]);
  if (!existing.rowCount) return { ok: false, reason: 'Case study not found.' };
  if (!canPublish(existing.rows[0].evidence_ids)) return { ok: false, reason: 'Cannot publish: no real evidence cited.' };
  await db.query(`UPDATE case_study SET status = 'published', updated_at = now() WHERE id = $1`, [id]);
  return { ok: true };
}

export async function listCaseStudies(tenantId: string) {
  const r = await db.query(`SELECT * FROM case_study WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
  return r.rows;
}
