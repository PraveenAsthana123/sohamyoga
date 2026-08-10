// GET /api/analytics/funnels — funnel definitions with step-by-step counts.
// Step conversion is approximated as "distinct sessions with >=1 matching event
// for that step's event_type" within the funnel's window — not strict ordered
// sequencing (that needs a window-function pass per session; left for later).

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FunnelRow { id: string; name: string; status: string; window_hours: number; created_at: string }
interface StepRow { id: string; funnel_id: string; step_order: number; name: string; event_type: string }

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const funnels = await query<FunnelRow>(
    `SELECT id, name, status::text, window_hours, created_at FROM funnel_definition ORDER BY created_at DESC`,
  );
  if (!funnels.rows.length) return Response.json({ funnels: [] });

  const steps = await query<StepRow>(
    `SELECT id, funnel_id, step_order, name, event_type::text FROM funnel_step
     WHERE funnel_id = ANY($1::uuid[]) ORDER BY funnel_id, step_order`,
    [funnels.rows.map(f => f.id)],
  );

  const result = await Promise.all(funnels.rows.map(async funnel => {
    const funnelSteps = steps.rows.filter(s => s.funnel_id === funnel.id);
    const counts = await Promise.all(funnelSteps.map(step =>
      query<{ count: string }>(
        `SELECT COUNT(DISTINCT anonymous_id) AS count FROM tracking_event
         WHERE event_type = $1 AND status = 'collected'
           AND created_at >= now() - ($2 || ' hours')::interval`,
        [step.event_type, funnel.window_hours],
      ),
    ));
    const stepResults = funnelSteps.map((s, i) => {
      const count = Number(counts[i].rows[0]?.count ?? 0);
      const entryCount = Number(counts[0]?.rows[0]?.count ?? 0);
      const prevCount = i > 0 ? Number(counts[i - 1].rows[0]?.count ?? 0) : count;
      return {
        name: s.name,
        eventType: s.event_type,
        count,
        convPct: entryCount ? Math.round((count / entryCount) * 1000) / 10 : 0,
        dropPct: i > 0 && prevCount ? Math.round(((prevCount - count) / prevCount) * 1000) / 10 : 0,
      };
    });
    const entryCount = stepResults[0]?.count ?? 0;
    const completedCount = stepResults.at(-1)?.count ?? 0;
    return {
      id: funnel.id, name: funnel.name, status: funnel.status, windowHours: funnel.window_hours,
      entryCount, completedCount,
      overallConvPct: entryCount ? Math.round((completedCount / entryCount) * 1000) / 10 : 0,
      steps: stepResults,
    };
  }));

  return Response.json({ funnels: result });
}
