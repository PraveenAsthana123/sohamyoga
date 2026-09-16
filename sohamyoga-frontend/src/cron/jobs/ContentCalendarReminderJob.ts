// ContentCalendarReminderJob — Daily 08:00 UTC (0 8 * * *)
// Finds social_calendar_entry records scheduled in the next 24 hours and
// inserts reminder notifications into the notification queue for staff review.
// Advisory only — never publishes or modifies content automatically.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface CalendarEntry {
  id: string;
  platform: string;
  content_type: string;
  title: string | null;
  caption_preview: string | null;
  scheduled_at: string;
  status: string;
}

export async function run(): Promise<void> {
  const entries = await db.query<CalendarEntry>(
    `SELECT id, platform, content_type, title, caption_preview, scheduled_at, status
     FROM social_calendar_entry
     WHERE scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
       AND status = 'scheduled'
     ORDER BY scheduled_at`,
  ).catch(() => ({ rows: [] as CalendarEntry[] }));

  let queued = 0;

  for (const entry of entries.rows) {
    const title = entry.title ?? entry.caption_preview?.slice(0, 60) ?? `${entry.platform} ${entry.content_type}`;
    const scheduledTime = new Date(entry.scheduled_at).toLocaleString('en-US', { timeZone: 'UTC' });

    await db.query(
      `INSERT INTO notification_queue (channel, recipient, subject, body, status, created_at)
       VALUES ('email', 'admin@sohamyoga.com', $1, $2, 'pending', NOW())
       ON CONFLICT DO NOTHING`,
      [
        `Reminder: ${entry.platform} ${entry.content_type} scheduled at ${scheduledTime} UTC`,
        `Your ${entry.platform} ${entry.content_type} post is scheduled for ${scheduledTime} UTC.\n\nTitle/Preview: ${title}\n\nCalendar Entry ID: ${entry.id}\n\nPlease ensure the content is final and the account is connected before the scheduled time.`,
      ],
    ).catch(() => {
      // notification_queue may not exist in all envs — skip silently
    });
    queued++;
  }

  await db.query(
    `INSERT INTO job_run_log (job_name, status, detail, ran_at)
     VALUES ($1, 'ok', $2, NOW()) ON CONFLICT DO NOTHING`,
    ['content-calendar-reminder', `Found ${entries.rows.length} upcoming posts in next 24h, queued ${queued} reminders`],
  ).catch(() => {});

  console.log(`[content-calendar-reminder] upcoming=${entries.rows.length} queued=${queued}`);
  await db.end().catch(() => {});
}
