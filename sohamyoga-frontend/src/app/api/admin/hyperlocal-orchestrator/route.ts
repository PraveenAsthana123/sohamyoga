import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ channels: [], jobs: [], summary: { totalChannels: 0, activeChannels: 0, warningChannels: 0, inactiveChannels: 0 } });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS channel_status (
        id SERIAL PRIMARY KEY,
        channel_name TEXT NOT NULL,
        channel_type TEXT DEFAULT 'social',
        is_active BOOLEAN DEFAULT false,
        last_post_at TIMESTAMPTZ,
        follower_count INTEGER DEFAULT 0,
        engagement_rate NUMERIC(6,4) DEFAULT 0,
        posts_this_month INTEGER DEFAULT 0,
        status TEXT DEFAULT 'inactive',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS orchestration_job (
        id SERIAL PRIMARY KEY,
        job_type TEXT NOT NULL,
        channels TEXT[],
        triggered_by TEXT,
        status TEXT DEFAULT 'pending',
        result_summary TEXT,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed default channels if empty
    const countRes = await client.query(`SELECT COUNT(*) FROM channel_status`).catch(() => ({ rows: [{ count: '1' }] }));
    if (Number(countRes.rows[0]?.count ?? 0) === 0) {
      const defaultChannels = [
        ['Facebook', 'social'], ['Instagram', 'social'], ['LinkedIn', 'social'],
        ['Twitter/X', 'social'], ['TikTok', 'social'], ['YouTube', 'social'],
        ['Snapchat', 'social'], ['Pinterest', 'social'], ['Reddit', 'listening'],
        ['Nextdoor', 'local'], ['Quora', 'authority'], ['WhatsApp', 'messaging'],
        ['Google Business', 'local-seo'], ['Google Ads', 'paid'], ['Meta Ads', 'paid'],
        ['Email', 'direct'], ['SMS', 'direct'], ['Push Notifications', 'direct'],
        ['Podcast', 'content'], ['Blog/SEO', 'content'], ['PR/Media', 'earned'],
        ['Affiliate', 'partner'], ['Referral', 'partner'], ['Community Events', 'offline'],
        ['Door Hanger / Flyer', 'offline'],
      ];
      for (const [name, type] of defaultChannels) {
        await client.query(
          `INSERT INTO channel_status (channel_name, channel_type, status) VALUES ($1,$2,'inactive') ON CONFLICT DO NOTHING`,
          [name, type]
        ).catch(() => null);
      }
    }

    const [channelsRes, jobsRes] = await Promise.all([
      client.query(`SELECT * FROM channel_status ORDER BY channel_name`).catch(() => ({ rows: [] })),
      client.query(`SELECT * FROM orchestration_job ORDER BY created_at DESC LIMIT 50`).catch(() => ({ rows: [] })),
    ]);

    const channels: Array<{ status: string; is_active: boolean }> = channelsRes.rows;
    const summary = {
      totalChannels: channels.length,
      activeChannels: channels.filter(c => c.is_active || c.status === 'active').length,
      warningChannels: channels.filter(c => c.status === 'warning').length,
      inactiveChannels: channels.filter(c => !c.is_active && c.status !== 'active' && c.status !== 'warning').length,
    };

    return Response.json({ channels: channelsRes.rows, jobs: jobsRes.rows, summary });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.action === 'toggle_channel' && body.channel_id) {
      const res = await client.query(`SELECT is_active FROM channel_status WHERE id = $1`, [body.channel_id]);
      if (res.rows[0]) {
        const newActive = !res.rows[0].is_active;
        await client.query(`UPDATE channel_status SET is_active = $1, status = $2, updated_at = NOW() WHERE id = $3`, [newActive, newActive ? 'active' : 'inactive', body.channel_id]);
        return Response.json({ ok: true, is_active: newActive });
      }
      return Response.json({ error: 'Channel not found' }, { status: 404 });
    }
    const result = await client.query(
      `INSERT INTO orchestration_job (job_type, channels, triggered_by, status, started_at) VALUES ($1,$2,$3,'running',NOW()) RETURNING *`,
      [body.job_type ?? 'sync', body.channels ?? [], body.triggered_by ?? 'admin']
    );
    return Response.json({ job: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
