import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS calendar_integration (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(30),
        account_email VARCHAR(200),
        calendar_name VARCHAR(200),
        is_enabled BOOLEAN DEFAULT false,
        sync_direction VARCHAR(20) DEFAULT 'both',
        last_sync_at TIMESTAMPTZ,
        sync_status VARCHAR(20) DEFAULT 'idle',
        access_token_env_var VARCHAR(100),
        events_synced INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS calendar_event_ext (
        id SERIAL PRIMARY KEY,
        external_id VARCHAR(300),
        provider VARCHAR(30),
        title VARCHAR(300),
        description TEXT,
        start_at TIMESTAMPTZ,
        end_at TIMESTAMPTZ,
        all_day BOOLEAN DEFAULT false,
        location VARCHAR(300),
        status VARCHAR(20) DEFAULT 'confirmed',
        event_type VARCHAR(30),
        is_local BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed 4 providers
    const providers = [
      { provider: 'google', account_email: 'admin@sohamyoga.com', calendar_name: 'SohamYoga Main', is_enabled: true, sync_direction: 'both', access_token_env_var: 'GOOGLE_CALENDAR_TOKEN', sync_status: 'synced', last_sync_at: new Date() },
      { provider: 'outlook', account_email: 'marketing@sohamyoga.com', calendar_name: 'Marketing Calendar', is_enabled: false, sync_direction: 'import', access_token_env_var: 'OUTLOOK_CALENDAR_TOKEN', sync_status: 'idle', last_sync_at: null },
      { provider: 'apple', account_email: 'ceo@sohamyoga.com', calendar_name: 'Executive Calendar', is_enabled: false, sync_direction: 'export', access_token_env_var: 'APPLE_CALENDAR_TOKEN', sync_status: 'idle', last_sync_at: null },
      { provider: 'ical', account_email: 'events@sohamyoga.com', calendar_name: 'Events Feed', is_enabled: true, sync_direction: 'import', access_token_env_var: 'ICAL_FEED_URL', sync_status: 'synced', last_sync_at: new Date() },
    ];

    for (const p of providers) {
      await pool.query(
        `INSERT INTO calendar_integration (provider, account_email, calendar_name, is_enabled, sync_direction, access_token_env_var, sync_status, last_sync_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [p.provider, p.account_email, p.calendar_name, p.is_enabled, p.sync_direction, p.access_token_env_var, p.sync_status, p.last_sync_at]
      );
    }

    // Seed 10 demo events
    const now = new Date();
    const events = [
      { title: 'Q4 Campaign Launch', event_type: 'campaign', start: 1, end: 2 },
      { title: 'Weekly Team Standup', event_type: 'meeting', start: 2, end: 2.5 },
      { title: 'Blog Post Publish: Yoga for Beginners', event_type: 'content_publish', start: 3, end: 3.5 },
      { title: 'Affiliate Partner Review', event_type: 'meeting', start: 5, end: 6 },
      { title: 'SEO Audit Deadline', event_type: 'deadline', start: 7, end: 7.5 },
      { title: 'Instagram Campaign Start', event_type: 'campaign', start: 10, end: 11 },
      { title: 'Monthly Analytics Review', event_type: 'meeting', start: 14, end: 15 },
      { title: 'Newsletter Send: October Edition', event_type: 'content_publish', start: 15, end: 15.5 },
      { title: 'Product Demo with Enterprise Lead', event_type: 'meeting', start: 18, end: 19 },
      { title: 'Black Friday Campaign Deadline', event_type: 'deadline', start: 25, end: 25.5 },
    ];

    for (const e of events) {
      const startAt = new Date(now.getTime() + e.start * 24 * 3600 * 1000);
      const endAt = new Date(now.getTime() + e.end * 24 * 3600 * 1000);
      await pool.query(
        `INSERT INTO calendar_event_ext (title, event_type, start_at, end_at, provider, is_local)
         VALUES ($1,$2,$3,$4,'local',true)`,
        [e.title, e.event_type, startAt, endAt]
      );
    }

    return NextResponse.json({ ok: true, message: 'Tables created, 4 integrations + 10 events seeded' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
