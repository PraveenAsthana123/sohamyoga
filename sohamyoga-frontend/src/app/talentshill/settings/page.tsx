'use client';

import { useState } from 'react';

interface ProfileForm {
  displayName: string;
  email: string;
  company: string;
  timezone: string;
  phone: string;
}

interface NotifPrefs {
  campaignReports: boolean;
  leadAlerts: boolean;
  socialMentions: boolean;
  budgetAlerts: boolean;
  weeklyDigest: boolean;
  monthlyReport: boolean;
}

const TIMEZONES = [
  'America/Toronto',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export default function TalentsHillSettingsPage() {
  const [profile, setProfile] = useState<ProfileForm>({
    displayName: 'Client User',
    email: typeof window !== 'undefined' ? localStorage.getItem('th_client_email') ?? '' : '',
    company: 'Your Company',
    timezone: 'America/Toronto',
    phone: '',
  });
  const [notifs, setNotifs] = useState<NotifPrefs>({
    campaignReports: true,
    leadAlerts: true,
    socialMentions: false,
    budgetAlerts: true,
    weeklyDigest: true,
    monthlyReport: true,
  });
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('th_client_email', profile.email);
      }
      setSaving(false);
      showToast('✅ Profile saved successfully.');
    }, 600);
  }

  function toggleNotif(key: keyof NotifPrefs) {
    setNotifs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const notifItems: { key: keyof NotifPrefs; label: string; desc: string }[] = [
    { key: 'campaignReports', label: 'Campaign Reports', desc: 'Receive reports when campaign milestones are reached.' },
    { key: 'leadAlerts', label: 'New Lead Alerts', desc: 'Instant notification when a new lead is captured.' },
    { key: 'socialMentions', label: 'Social Mentions', desc: 'Alert when your brand is mentioned on social media.' },
    { key: 'budgetAlerts', label: 'Budget Alerts', desc: 'Notify when ad spend reaches 80% or 100% of budget.' },
    { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Summary email every Monday with last week\'s performance.' },
    { key: 'monthlyReport', label: 'Monthly Report', desc: 'Full PDF performance report on the first of each month.' },
  ];

  return (
    <div className="space-y-8 max-w-2xl relative">
      {toast && (
        <div className="fixed top-6 right-6 z-[100] backdrop-blur-md bg-green-500/20 border border-green-400/30 rounded-xl px-5 py-3 text-green-300 text-sm shadow-xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-white/50 mt-1 text-sm">Manage your profile, preferences, and notification settings.</p>
      </div>

      {/* Profile Form */}
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-5">Profile</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/70 text-sm mb-1.5">Display Name</label>
              <input
                type="text"
                value={profile.displayName}
                onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                className="bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 w-full backdrop-blur-sm focus:outline-none focus:border-blue-400/60 transition-all"
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1.5">Email</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 w-full backdrop-blur-sm focus:outline-none focus:border-blue-400/60 transition-all"
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/70 text-sm mb-1.5">Company</label>
              <input
                type="text"
                value={profile.company}
                onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                className="bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 w-full backdrop-blur-sm focus:outline-none focus:border-blue-400/60 transition-all"
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1.5">Phone (optional)</label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+1 555 000 0000"
                className="bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 w-full backdrop-blur-sm focus:outline-none focus:border-blue-400/60 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-white/70 text-sm mb-1.5">Timezone</label>
            <select
              value={profile.timezone}
              onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
              className="bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3 w-full backdrop-blur-sm focus:outline-none focus:border-blue-400/60 transition-all"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz} className="bg-slate-900">{tz}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-500/80 hover:bg-blue-400/90 backdrop-blur-sm border border-blue-400/30 text-white rounded-xl px-6 py-3 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* Notification Preferences */}
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-5">Notification Preferences</h2>
        <div className="space-y-4">
          {notifItems.map(({ key, label, desc }) => (
            <div key={key} className="flex items-start justify-between gap-4 py-2 border-b border-white/10 last:border-0">
              <div>
                <p className="text-white/80 text-sm font-medium">{label}</p>
                <p className="text-white/40 text-xs mt-0.5">{desc}</p>
              </div>
              <button
                onClick={() => toggleNotif(key)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors border ${notifs[key] ? 'bg-blue-500/60 border-blue-400/40' : 'bg-white/10 border-white/20'}`}
                role="switch"
                aria-checked={notifs[key]}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifs[key] ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => showToast('✅ Notification preferences saved.')}
          className="mt-5 bg-blue-500/80 hover:bg-blue-400/90 backdrop-blur-sm border border-blue-400/30 text-white rounded-xl px-6 py-3 text-sm font-semibold transition-all"
        >
          Save Preferences
        </button>
      </div>

      {/* Danger Zone */}
      <div className="backdrop-blur-md bg-red-500/10 border border-red-400/20 rounded-2xl shadow-xl p-6">
        <h2 className="text-lg font-semibold text-red-300 mb-2">Danger Zone</h2>
        <p className="text-white/50 text-sm mb-4">
          These actions are irreversible. Please contact your account manager before proceeding.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => showToast('📧 Request sent to your account manager.')}
            className="backdrop-blur-md bg-white/5 border border-white/10 text-white/70 hover:text-white rounded-xl px-5 py-2.5 text-sm transition-all hover:bg-white/10"
          >
            Request Data Export
          </button>
          <button
            onClick={() => showToast('📧 Account closure request sent to your account manager.')}
            className="backdrop-blur-md bg-red-500/20 border border-red-400/30 text-red-300 hover:bg-red-500/30 rounded-xl px-5 py-2.5 text-sm transition-all"
          >
            Close Account
          </button>
        </div>
      </div>
    </div>
  );
}
