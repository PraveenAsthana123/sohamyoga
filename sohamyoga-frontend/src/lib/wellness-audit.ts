import { query } from '@/lib/postgres';

// wellness_audit is the HIPAA/PIPEDA-mandated trail declared in
// src/domain/wellness/db-schema.sql -- every read/export/delete of sensitive
// health_profile data must be logged with who did it and their legal basis.
export async function logWellnessAudit(params: {
  tenantId: string;
  action: 'health_profile_accessed' | 'health_profile_created_or_updated' | 'health_data_exported' | 'health_profile_deleted';
  actor: string;
  customerId?: string;
  profileId?: string;
  legalBasis?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO wellness_audit (tenant_id, action, actor, customer_id, profile_id, legal_basis, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [params.tenantId, params.action, params.actor, params.customerId ?? null, params.profileId ?? null,
     params.legalBasis ?? null, params.payload ? JSON.stringify(params.payload) : null],
  );
}
