import { query } from '@/lib/postgres';

export interface RedirectRule {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  createdAt: Date;
}

interface Row { id: string; from_path: string; to_path: string; status_code: number; created_at: Date }

function toEntity(r: Row): RedirectRule {
  return { id: r.id, fromPath: r.from_path, toPath: r.to_path, statusCode: r.status_code, createdAt: new Date(r.created_at) };
}

export async function listRedirectRules(tenantId: string): Promise<RedirectRule[]> {
  const { rows } = await query<Row>('SELECT * FROM seo_redirect_rule WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
  return rows.map(toEntity);
}

export async function createRedirectRule(tenantId: string, fromPath: string, toPath: string, statusCode: number): Promise<RedirectRule> {
  const { rows } = await query<Row>(
    `INSERT INTO seo_redirect_rule (tenant_id, from_path, to_path, status_code) VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_id, from_path) DO UPDATE SET to_path = $3, status_code = $4
     RETURNING *`,
    [tenantId, fromPath, toPath, statusCode]
  );
  return toEntity(rows[0]);
}

export async function deleteRedirectRule(tenantId: string, id: string): Promise<boolean> {
  const { rowCount } = await query('DELETE FROM seo_redirect_rule WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  return (rowCount ?? 0) > 0;
}
