'use client';
// /customer/preferences — real persistence via customer table columns.
// Replaces /student/preferences, which held a much larger set of fields
// (timezone, birthday, calendar sync, push notifications, poll opt-in) with
// no backing table at all -- a fake "Saved" toast and a TODO for the real
// POST. This version only offers fields that are genuinely persisted.

import { useEffect, useState } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const STYLES = ['Hatha', 'Vinyasa', 'Yin', 'Ashtanga', 'Kundalini', 'Restorative', 'Power'];
const TIMES = ['Early morning', 'Morning', 'Midday', 'Afternoon', 'Evening'];

interface Prefs {
  preferred_class_styles: string[]; preferred_class_times: string[];
  reminder_minutes_before: number; goal_statement: string; email_opt_in: boolean; sms_opt_in: boolean;
}

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [status, setStatus] = useState('');
  const push = usePushNotifications();

  useEffect(() => {
    fetch('/api/customer/preferences', { cache: 'no-store' }).then(r => r.json()).then(d => setPrefs(d.preferences ?? null));
  }, []);

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter(v => v !== value) : [...list, value];
  }

  async function save() {
    if (!prefs) return;
    setStatus('Saving…');
    const res = await fetch('/api/customer/preferences', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferredClassStyles: prefs.preferred_class_styles, preferredClassTimes: prefs.preferred_class_times,
        reminderMinutesBefore: prefs.reminder_minutes_before, goalStatement: prefs.goal_statement,
        emailOptIn: prefs.email_opt_in, smsOptIn: prefs.sms_opt_in,
      }),
    });
    const d = await res.json();
    setStatus(res.ok ? 'Saved.' : d.error);
  }

  if (!prefs) return <p className="text-sm text-gray-400">Loading…</p>;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Preferences</h1>
        <p className="mt-1 text-sm text-gray-500">Saved to your real account — used by class recommendations and reminders.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div>
          <label className="text-sm font-medium">Preferred styles</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {STYLES.map(s => (
              <button key={s} type="button" onClick={() => setPrefs({ ...prefs, preferred_class_styles: toggle(prefs.preferred_class_styles, s) })}
                className={`rounded-full px-3 py-1 text-xs ${prefs.preferred_class_styles.includes(s) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Preferred times</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {TIMES.map(t => (
              <button key={t} type="button" onClick={() => setPrefs({ ...prefs, preferred_class_times: toggle(prefs.preferred_class_times, t) })}
                className={`rounded-full px-3 py-1 text-xs ${prefs.preferred_class_times.includes(t) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Class reminder</label>
          <select className="mt-1 w-full rounded border p-2 text-sm" value={prefs.reminder_minutes_before}
            onChange={e => setPrefs({ ...prefs, reminder_minutes_before: Number(e.target.value) })}>
            <option value={0}>Off</option>
            <option value={15}>15 minutes before</option>
            <option value={30}>30 minutes before</option>
            <option value={60}>1 hour before</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Your goal</label>
          <textarea className="mt-1 w-full rounded border p-2 text-sm" value={prefs.goal_statement}
            onChange={e => setPrefs({ ...prefs, goal_statement: e.target.value })} placeholder="e.g. reduce stress and build flexibility" />
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prefs.email_opt_in} onChange={e => setPrefs({ ...prefs, email_opt_in: e.target.checked })} /> Email updates</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prefs.sms_opt_in} onChange={e => setPrefs({ ...prefs, sms_opt_in: e.target.checked })} /> SMS updates</label>
        </div>
        <button onClick={save} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white">Save preferences</button>
        {status && <p className="text-sm text-gray-500">{status}</p>}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-2">
        <label className="text-sm font-medium">Browser push notifications</label>
        <p className="text-xs text-gray-500">Get class reminders and alerts on this device, even when SohamYoga isn&apos;t open in a tab.</p>
        {push.state === 'unsupported' && <p className="text-sm text-gray-500">Not supported in this browser.</p>}
        {push.state === 'denied' && <p className="text-sm text-red-600">Blocked — enable notifications for this site in your browser settings.</p>}
        {(push.state === 'subscribed' || push.state === 'unsubscribed') && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={push.state === 'subscribed'}
              disabled={push.loading}
              onChange={e => (e.target.checked ? push.subscribe() : push.unsubscribe())}
            />
            {push.state === 'subscribed' ? 'Enabled on this device' : 'Enable on this device'}
          </label>
        )}
        {push.error && <p className="text-sm text-red-600">{push.error}</p>}
      </div>
    </div>
  );
}
