import { NextRequest } from 'next/server';
import { databaseConfigured, query, transaction } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { generateInitialHumanTasks } from '@/domain/social/provisioning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real, one-time setup step: creates a DRAFT account_provisioning_job for
// every registered platform that doesn't already have one for this tenant,
// and seeds each job's real starting human-task checklist derived from that
// platform's own requirement flags (never a generic list). This is the
// tracking/queue layer only -- it creates no live social media account.
// Actual account creation still requires a human to do it (choose a handle,
// verify email/phone, pass CAPTCHA/2FA, submit business documents where
// required) or an assisted Skyvern run that itself stops at every one of
// those checkpoints.
export async function POST(req: NextRequest) {
  const auth = await getAdminPrincipal(req); if (auth.denied) return auth.denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => ({})) as { accountName?: string };
  const accountName = body.accountName?.trim();
  if (!accountName) return Response.json({ error: 'accountName is required.' }, { status: 400 });

  const tenant = await query<{ id: string }>(`SELECT id FROM tenant ORDER BY created_at LIMIT 1`);
  const tenantId = tenant.rows[0]?.id;
  if (!tenantId) return Response.json({ error: 'No tenant exists; create the business tenant first.' }, { status: 409 });

  const requirements = await query<{
    platform: string; requires_captcha: boolean; requires_otp: boolean; requires_phone: boolean;
    requires_2fa: boolean; requires_identity_verification: boolean; requires_business_verification: boolean;
    oauth_supported: boolean;
  }>(`SELECT platform, requires_captcha, requires_otp, requires_phone, requires_2fa,
             requires_identity_verification, requires_business_verification, oauth_supported
      FROM social_platform_requirement ORDER BY platform`);

  const existing = await query<{ platform: string }>(
    `SELECT DISTINCT platform FROM account_provisioning_job WHERE tenant_id = $1 AND state <> 'CANCELLED'`,
    [tenantId],
  );
  const alreadySet = new Set(existing.rows.map(r => r.platform));
  const toCreate = requirements.rows.filter(r => !alreadySet.has(r.platform));

  const created = await transaction(async client => {
    const jobs: { platform: string; jobId: string; taskCount: number }[] = [];
    for (const r of toCreate) {
      const job = await client.query<{ id: string }>(
        `INSERT INTO account_provisioning_job (tenant_id, platform, account_name, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
        [tenantId, r.platform, accountName, auth.principal!.id],
      );
      const jobId = job.rows[0].id;
      await client.query(
        `INSERT INTO social_provisioning_event (job_id, tenant_id, platform, actor_type, actor_id, action, after_state, result)
         VALUES ($1,$2,$3,'HUMAN',$4,'JOB_CREATED','DRAFT','success')`,
        [jobId, tenantId, r.platform, auth.principal!.id],
      );
      const tasks = generateInitialHumanTasks(r);
      for (const t of tasks) {
        await client.query(
          `INSERT INTO provisioning_human_task (job_id, tenant_id, platform, task_type, instructions) VALUES ($1,$2,$3,$4,$5)`,
          [jobId, tenantId, r.platform, t.taskType, t.instructions],
        );
      }
      jobs.push({ platform: r.platform, jobId, taskCount: tasks.length });
    }
    return jobs;
  });

  return Response.json({
    createdCount: created.length,
    skippedCount: requirements.rows.length - created.length,
    jobs: created,
  }, { status: 201 });
}
