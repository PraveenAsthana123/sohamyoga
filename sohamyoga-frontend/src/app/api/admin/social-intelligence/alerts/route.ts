import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

export async function GET(req: NextRequest) {
  await ensureSocialIntelligenceSchema();
  const platform = req.nextUrl.searchParams.get('platform');
  const conditions = platform ? ['(platform = $1 OR platform IS NULL)'] : [];
  const params = platform ? [platform] : [];
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rulesResult, eventsResult] = await Promise.all([
    query(`SELECT * FROM social_alert_rule ${where} ORDER BY severity, created_at DESC`, params),
    query(`SELECT * FROM social_alert_event ORDER BY triggered_at DESC LIMIT 20`),
  ]);
  return NextResponse.json({ rules: rulesResult.rows, recent_events: eventsResult.rows });
}

export async function POST(req: NextRequest) {
  await ensureSocialIntelligenceSchema();
  const body = await req.json();
  const { platform, alert_type, metric, threshold_value, comparison, window_minutes, severity, notification_channels } = body;
  if (!alert_type) return NextResponse.json({ error: 'alert_type required' }, { status: 400 });
  const result = await query(
    `INSERT INTO social_alert_rule (platform, alert_type, metric, threshold_value, comparison, window_minutes, severity, notification_channels)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [platform ?? null, alert_type, metric ?? null, threshold_value ?? null, comparison ?? null, window_minutes ?? 60, severity ?? 'medium', notification_channels ?? ['email']],
  );
  return NextResponse.json({ rule: result.rows[0] }, { status: 201 });
}
