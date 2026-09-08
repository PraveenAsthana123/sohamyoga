import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real, honest integration status. No fabricated "connected" states --
// email/SMS sending genuinely has no provider deployed in this environment
// (documented elsewhere this session: no SMTP/Novu/Matomo), and no OAuth
// calendar/wearable integration exists. Calendar export is real and works
// today via the standard .ics format, no external account needed.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const prefs = await query<{ email_opt_in: boolean; sms_opt_in: boolean }>(
    `SELECT email_opt_in, sms_opt_in FROM customer WHERE user_id = $1`, [principal!.id],
  );

  const integrations = [
    {
      key: 'calendar_ics', label: 'Calendar Export (.ics)', status: 'available',
      description: 'Download your real upcoming bookings as a standard calendar file — opens in Google Calendar, Outlook, or Apple Calendar.',
      actionUrl: '/api/customer/bookings/ical', actionLabel: 'Download .ics',
    },
    {
      key: 'google_calendar', label: 'Google Calendar Sync', status: 'not_available',
      description: 'Automatic two-way sync isn\'t built yet — no Google OAuth connection exists in this app. Use Calendar Export above in the meantime.',
    },
    {
      key: 'email', label: 'Email Notifications', status: prefs.rows[0]?.email_opt_in ? 'preference_on_no_provider' : 'preference_off',
      description: 'You can opt in under Preferences, but no email provider is deployed yet — nothing is actually sent.',
    },
    {
      key: 'sms', label: 'SMS Notifications', status: prefs.rows[0]?.sms_opt_in ? 'preference_on_no_provider' : 'preference_off',
      description: 'You can opt in under Preferences, but no SMS provider is deployed yet — nothing is actually sent.',
    },
    {
      key: 'wearable', label: 'Fitness Tracker / Wearable Sync', status: 'not_available',
      description: 'Not built — no wearable integration exists in this app.',
    },
  ];

  return Response.json({ integrations });
}
