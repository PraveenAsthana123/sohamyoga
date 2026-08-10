import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; name: string; campaign_type: string; channels: string[]; status: string;
    audience_label: string; audience_size: number; goal_type: string; goal_target: number;
    conversions: number; revenue_cad: string; scheduled_at: string | null; created_at: string;
  }>(
    `SELECT id, name, campaign_type, channels, status, audience_label, audience_size,
            goal_type, goal_target, conversions, revenue_cad, scheduled_at, created_at
     FROM lifecycle_campaign ORDER BY created_at DESC`,
  );

  return Response.json({
    campaigns: rows.rows.map(c => ({
      id: c.id, name: c.name, type: c.campaign_type, channels: c.channels, status: c.status,
      audience: c.audience_label, audienceSize: c.audience_size, goalType: c.goal_type,
      goalTarget: c.goal_target, conversions: c.conversions, revenueCAD: Number(c.revenue_cad),
      scheduledAt: c.scheduled_at ?? undefined, createdAt: c.created_at,
    })),
  });
}
