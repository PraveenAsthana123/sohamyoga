import { NextRequest } from 'next/server';
import { databaseConfigured, query, transaction } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { canTransition, type ProvisioningState } from '@/domain/social/provisioning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Advances every DRAFT job as far as is honestly possible with pure data
// validation: DRAFT -> PROFILE_READY -> VALIDATION_PASSED. Deliberately goes
// no further. SIGNUP_STARTED and everything after it means a human has
// actually begun the real signup flow on the real platform -- that cannot be
// satisfied by a database update, so this endpoint refuses to touch it.
function validateProfile(accountName: string): { passed: boolean; reason?: string } {
  const trimmed = accountName.trim();
  if (trimmed.length < 2) return { passed: false, reason: 'Account name is too short to be a usable handle.' };
  if (trimmed.length > 100) return { passed: false, reason: 'Account name exceeds a reasonable handle length.' };
  return { passed: true };
}

export async function POST(req: NextRequest) {
  const auth = await getAdminPrincipal(req); if (auth.denied) return auth.denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const drafts = await query<{ id: string; tenant_id: string; platform: string; account_name: string }>(
    `SELECT id, tenant_id, platform, account_name FROM account_provisioning_job WHERE state = 'DRAFT'`,
  );

  const results = await transaction(async client => {
    const advanced: { platform: string; reachedState: ProvisioningState }[] = [];
    const blocked: { platform: string; reason: string }[] = [];

    for (const job of drafts.rows) {
      const validation = validateProfile(job.account_name);
      if (!validation.passed) {
        blocked.push({ platform: job.platform, reason: validation.reason! });
        continue;
      }

      let state: ProvisioningState = 'DRAFT';
      for (const next of ['PROFILE_READY', 'VALIDATION_PASSED'] as ProvisioningState[]) {
        if (!canTransition(state, next)) break;
        await client.query(
          `UPDATE account_provisioning_job SET state = $2, version = version + 1, updated_at = now() WHERE id = $1`,
          [job.id, next],
        );
        await client.query(
          `INSERT INTO social_provisioning_event (job_id, tenant_id, platform, actor_type, actor_id, action, before_state, after_state, result)
           VALUES ($1,$2,$3,'HUMAN',$4,'STATE_TRANSITION',$5,$6,'success')`,
          [job.id, job.tenant_id, job.platform, auth.principal!.id, state, next],
        );
        state = next;
      }
      await client.query(
        `UPDATE account_provisioning_job SET current_step = $2 WHERE id = $1`,
        [job.id, 'Ready to begin real signup — visit the platform\'s signup URL to continue. This step requires a human.'],
      );
      advanced.push({ platform: job.platform, reachedState: state });
    }
    return { advanced, blocked };
  });

  return Response.json({
    advancedCount: results.advanced.length,
    blockedCount: results.blocked.length,
    ...results,
  });
}
