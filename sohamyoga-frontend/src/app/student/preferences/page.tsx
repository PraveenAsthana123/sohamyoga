"use client";
import { useState } from "react";

const TIMEZONES = [
  "America/Vancouver", "America/Toronto", "America/New_York",
  "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Paris", "Asia/Dubai",
  "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney",
];

const STYLES = ["Hatha", "Vinyasa", "Yin", "Ashtanga", "Kundalini", "Restorative", "Power"];
const TIMES  = ["Early morning (5–7 AM)", "Morning (7–10 AM)", "Midday (10 AM–1 PM)", "Afternoon (1–5 PM)", "Evening (5–9 PM)"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

interface Prefs {
  timezone: string;
  preferredLevel: string;
  preferredStyles: string[];
  preferredTimes: string[];
  goalStatement: string;
  birthday: string;
  receiveWishes: boolean;
  calendarSync: boolean;
  reminderMinutes: number;
  emailNotif: boolean;
  whatsappNotif: boolean;
  pushNotif: boolean;
  allowPolls: boolean;
}

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState<Prefs>({
    timezone: "America/Vancouver",
    preferredLevel: "Beginner",
    preferredStyles: [],
    preferredTimes: ["Morning (7–10 AM)"],
    goalStatement: "",
    birthday: "",
    receiveWishes: true,
    calendarSync: false,
    reminderMinutes: 30,
    emailNotif: true,
    whatsappNotif: true,
    pushNotif: false,
    allowPolls: true,
  });
  const [saved, setSaved] = useState(false);

  function toggle<K extends keyof Prefs>(arr: K, value: string) {
    const cur = prefs[arr] as string[];
    setPrefs(p => ({ ...p, [arr]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] }));
  }

  function save() {
    // TODO: POST to /api/user/preferences
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">My Preferences</h1>
          <p className="text-gray-400 mt-1">Personalise your SohamYoga experience</p>
        </div>

        {/* Timezone */}
        <section className="bg-gray-900 rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold text-gray-200">Timezone</h2>
          <select value={prefs.timezone} onChange={e => setPrefs(p => ({ ...p, timezone: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white">
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
          <p className="text-xs text-gray-500">Class times and reminders are shown in this timezone.</p>
        </section>

        {/* Practice preferences */}
        <section className="bg-gray-900 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-200">Practice Preferences</h2>

          <div>
            <label className="text-sm text-gray-400 block mb-2">Level</label>
            <div className="flex gap-2">
              {LEVELS.map(l => (
                <button key={l} onClick={() => setPrefs(p => ({ ...p, preferredLevel: l }))}
                  className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                    prefs.preferredLevel === l ? "bg-green-700 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}>{l}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-2">Preferred Styles</label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map(s => (
                <button key={s} onClick={() => toggle("preferredStyles", s)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    prefs.preferredStyles.includes(s) ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}>{s}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-2">Preferred Class Times</label>
            <div className="flex flex-wrap gap-2">
              {TIMES.map(t => (
                <button key={t} onClick={() => toggle("preferredTimes", t)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    prefs.preferredTimes.includes(t) ? "bg-green-700 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}>{t}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-2">My Yoga Goal</label>
            <textarea value={prefs.goalStatement} onChange={e => setPrefs(p => ({ ...p, goalStatement: e.target.value }))}
              placeholder="e.g. Reduce stress, improve flexibility, build morning routine…"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 resize-none"
              rows={2} />
          </div>
        </section>

        {/* Calendar & reminders */}
        <section className="bg-gray-900 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-200">Calendar & Reminders</h2>

          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Sync to calendar</p>
              <p className="text-xs text-gray-400">Add bookings to Google/Apple calendar automatically</p>
            </div>
            <input type="checkbox" checked={prefs.calendarSync} onChange={e => setPrefs(p => ({ ...p, calendarSync: e.target.checked }))}
              className="w-5 h-5 accent-green-500" />
          </label>

          <div>
            <label className="text-sm text-gray-400 block mb-2">Class reminder</label>
            <select value={prefs.reminderMinutes} onChange={e => setPrefs(p => ({ ...p, reminderMinutes: Number(e.target.value) }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white">
              <option value={0}>No reminder</option>
              <option value={15}>15 minutes before</option>
              <option value={30}>30 minutes before</option>
              <option value={60}>1 hour before</option>
              <option value={120}>2 hours before</option>
            </select>
          </div>
        </section>

        {/* Birthday & wishes */}
        <section className="bg-gray-900 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-200">Birthday & Celebrations</h2>

          <div>
            <label className="text-sm text-gray-400 block mb-2">Birthday (MM-DD, optional)</label>
            <input type="text" value={prefs.birthday} onChange={e => setPrefs(p => ({ ...p, birthday: e.target.value }))}
              placeholder="08-15"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500" />
            <p className="text-xs text-gray-500 mt-1">Year not stored. Used only to send you a birthday wish.</p>
          </div>

          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Receive birthday & anniversary wishes</p>
              <p className="text-xs text-gray-400">We will send a personalised card on your special days</p>
            </div>
            <input type="checkbox" checked={prefs.receiveWishes} onChange={e => setPrefs(p => ({ ...p, receiveWishes: e.target.checked }))}
              className="w-5 h-5 accent-green-500" />
          </label>
        </section>

        {/* Notifications */}
        <section className="bg-gray-900 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-200">Notification Channels</h2>
          {[
            { key: "emailNotif" as const,    label: "Email",     desc: "Confirmations, reminders, and newsletters" },
            { key: "whatsappNotif" as const, label: "WhatsApp",  desc: "Class reminders and urgent updates" },
            { key: "pushNotif" as const,     label: "Push",      desc: "Browser/app push notifications" },
            { key: "allowPolls" as const,    label: "Community Polls", desc: "Receive polls from teachers and admins" },
          ].map(({ key, label, desc }) => (
            <label key={key} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              <input type="checkbox" checked={prefs[key] as boolean}
                onChange={e => setPrefs(p => ({ ...p, [key]: e.target.checked }))}
                className="w-5 h-5 accent-green-500" />
            </label>
          ))}
        </section>

        <button onClick={save}
          className={`w-full py-4 rounded-xl font-semibold text-white transition-colors ${
            saved ? "bg-green-500" : "bg-green-600 hover:bg-green-700"
          }`}>
          {saved ? "Saved!" : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}
