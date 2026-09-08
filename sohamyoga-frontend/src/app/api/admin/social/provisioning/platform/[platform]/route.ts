import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Full real detail for one platform's provisioning page: its requirement
// record, its job(s), that job's human tasks, and the real event timeline.
// Everything here is scoped to what actually exists for this platform --
// an unset field renders as "not recorded," never a filled-in guess.
export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  const auth = await getAdminPrincipal(req); if (auth.denied) return auth.denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const requirement = await query(`SELECT * FROM social_platform_requirement WHERE platform = $1`, [params.platform]);
  if (!requirement.rowCount) return Response.json({ error: 'Unknown platform.' }, { status: 404 });

  const [jobs, tasks, events] = await Promise.all([
    query(`SELECT * FROM account_provisioning_job WHERE platform = $1 ORDER BY updated_at DESC`, [params.platform]),
    query(`SELECT t.* FROM provisioning_human_task t
           JOIN account_provisioning_job j ON j.id = t.job_id
           WHERE t.platform = $1 ORDER BY (t.status = 'open') DESC, t.created_at`, [params.platform]),
    query(`SELECT * FROM social_provisioning_event WHERE platform = $1 ORDER BY created_at DESC LIMIT 100`, [params.platform]),
  ]);

  const browserRuns = await query(
    `SELECT br.* FROM provisioning_browser_run br
     JOIN account_provisioning_job j ON j.id = br.job_id WHERE j.platform = $1 ORDER BY br.created_at DESC LIMIT 20`,
    [params.platform],
  ).catch(() => ({ rows: [] as unknown[] }));

  return Response.json({
    requirement: requirement.rows[0],
    jobs: jobs.rows,
    tasks: tasks.rows,
    events: events.rows,
    browserRuns: browserRuns.rows,
  });
}
