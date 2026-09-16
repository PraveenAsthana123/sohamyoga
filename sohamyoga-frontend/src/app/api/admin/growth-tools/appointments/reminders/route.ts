import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AppointmentRow {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  appointment_type: string | null;
  appointment_at: string;
  location: string | null;
}

async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  // When SMTP_HOST configured, send real email. Otherwise demo mode.
  if (!process.env.SMTP_HOST) return false;
  try {
    const res = await fetch(`http://localhost:3001/api/internal/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch { return false; }
}

async function sendSms(to: string, message: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: message }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch { return false; }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();

  // 24h window: 23h to 25h from now
  const { rows: due24h } = await pool.query<AppointmentRow>(
    `SELECT * FROM appointment_reminders
     WHERE status='confirmed'
       AND reminder_sent_24h=false
       AND appointment_at BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'`,
  );

  // 1h window: 55min to 65min from now
  const { rows: due1h } = await pool.query<AppointmentRow>(
    `SELECT * FROM appointment_reminders
     WHERE status='confirmed'
       AND reminder_sent_1h=false
       AND appointment_at BETWEEN NOW() + INTERVAL '55 minutes' AND NOW() + INTERVAL '65 minutes'`,
  );

  const sent24: string[] = [];
  const sent1: string[] = [];
  const warnings: string[] = [];

  for (const appt of due24h) {
    const name = appt.customer_name || 'there';
    const dtStr = new Date(appt.appointment_at).toLocaleString('en-CA', { timeZone: 'America/Toronto' });
    const subject = `Reminder: Your ${appt.appointment_type || 'appointment'} tomorrow`;
    const emailBody = `Hi ${name},\n\nThis is a reminder that you have a ${appt.appointment_type || 'appointment'} scheduled for ${dtStr} at ${appt.location || 'our studio'}.\n\nSee you soon!\n— Soham Yoga`;
    const smsMsg = `Soham Yoga: Reminder — ${appt.appointment_type || 'appointment'} tomorrow at ${dtStr}. Questions? Reply to this message.`;

    let channelUsed = 'demo';
    if (appt.customer_email) {
      const ok = await sendEmail(appt.customer_email, subject, emailBody);
      if (ok) channelUsed = 'email';
    }
    if (appt.customer_phone) {
      const ok = await sendSms(appt.customer_phone, smsMsg);
      if (ok) channelUsed = channelUsed === 'email' ? 'email+sms' : 'sms';
    }

    await pool.query(`UPDATE appointment_reminders SET reminder_sent_24h=true WHERE id=$1`, [appt.id]);
    sent24.push(`${appt.customer_name || appt.id} [${channelUsed}]`);
  }

  for (const appt of due1h) {
    const name = appt.customer_name || 'there';
    const dtStr = new Date(appt.appointment_at).toLocaleString('en-CA', { timeZone: 'America/Toronto' });
    const subject = `Starting soon: ${appt.appointment_type || 'Your appointment'} in 1 hour`;
    const emailBody = `Hi ${name},\n\nYour ${appt.appointment_type || 'appointment'} starts in about 1 hour at ${dtStr}.\nLocation: ${appt.location || 'our studio'}\n\nSee you soon!\n— Soham Yoga`;
    const smsMsg = `Soham Yoga: Your ${appt.appointment_type || 'appointment'} is in 1 hour (${dtStr}). We are looking forward to seeing you!`;

    let channelUsed = 'demo';
    if (appt.customer_email) {
      const ok = await sendEmail(appt.customer_email, subject, emailBody);
      if (ok) channelUsed = 'email';
    }
    if (appt.customer_phone) {
      const ok = await sendSms(appt.customer_phone, smsMsg);
      if (ok) channelUsed = channelUsed === 'email' ? 'email+sms' : 'sms';
    }

    await pool.query(`UPDATE appointment_reminders SET reminder_sent_1h=true WHERE id=$1`, [appt.id]);
    sent1.push(`${appt.customer_name || appt.id} [${channelUsed}]`);
  }

  if (!process.env.SMTP_HOST && !process.env.TWILIO_ACCOUNT_SID) {
    warnings.push('Demo mode: configure SMTP_HOST or TWILIO_ACCOUNT_SID to send real reminders');
  }

  return Response.json({ sent_24h: sent24.length, sent_1h: sent1.length, recipients_24h: sent24, recipients_1h: sent1, warnings });
}
