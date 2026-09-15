import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export interface PositioningInput { targetCustomer: string; problem: string; category: string; outcome: string; alternative: string; proof: string }

// Pure, unit-tested: real template assembly, no fabricated filler.
export function renderPositioningStatement(p: PositioningInput): string {
  return `For ${p.targetCustomer} who ${p.problem}, this is a ${p.category} that ${p.outcome}, unlike ${p.alternative}, because ${p.proof}.`;
}

export async function savePositioningStatement(tenantId: string, input: PositioningInput, createdBy: string) {
  const r = await db.query(
    `INSERT INTO positioning_statement (tenant_id, target_customer, problem, category, outcome, alternative, proof, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (tenant_id) DO UPDATE SET target_customer=$2, problem=$3, category=$4, outcome=$5, alternative=$6, proof=$7, updated_at=now()
     RETURNING *`,
    [tenantId, input.targetCustomer, input.problem, input.category, input.outcome, input.alternative, input.proof, createdBy],
  );
  return r.rows[0];
}

export async function getPositioningStatement(tenantId: string) {
  const r = await db.query(`SELECT * FROM positioning_statement WHERE tenant_id = $1`, [tenantId]);
  return r.rows[0] ?? null;
}
