"use client";
import { useState } from "react";
import Link from "next/link";

const TABS = ["Overview", "Wellness", "Bookings", "Journey", "Wallet", "Achievements"] as const;
type Tab = typeof TABS[number];

function StatCard({ label, value, unit, sub, color = "green" }: { label: string; value: string | number; unit?: string; sub?: string; color?: string }) {
  const c: Record<string, string> = { green: "text-green-400", blue: "text-blue-400", amber: "text-amber-400", purple: "text-purple-400", teal: "text-teal-400", rose: "text-rose-400" };
  return (
    <div className="bg-gray-900 rounded-2xl p-4 text-center">
      <div className={`text-2xl font-bold ${c[color] ?? c.green}`}>{value}{unit && <span className="text-base font-normal ml-0.5">{unit}</span>}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, max, color = "bg-green-500" }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-1.5 bg-gray-800 rounded-full">
      <div className={`h-1.5 ${color} rounded-full`} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      {/* Primary KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <StatCard label="Classes (Month)" value={18}         color="green" />
        <StatCard label="Day Streak"      value={12}  unit="d" color="amber" />
        <StatCard label="Practice Hours"  value={24}  unit="h" color="blue" />
        <StatCard label="XP Points"       value={2840}        color="purple" />
        <StatCard label="Wellness Score"  value={74}  unit="/100" color="teal" />
        <StatCard label="Next Class"      value="07:00" sub="Tomorrow Flow" color="green" />
      </div>
      {/* Upcoming classes */}
      <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-300">Upcoming Classes</h2>
          <Link href="/booking" className="text-green-400 hover:text-green-300 text-xs">Browse all →</Link>
        </div>
        {[
          { title: "Morning Flow", teacher: "Priya Sharma", dateTime: "Tomorrow 7:00 AM", style: "Hatha", spots: 3 },
          { title: "Yin Restore",  teacher: "Anita Mehta",  dateTime: "Thu 6:00 PM",       style: "Yin",   spots: 6 },
          { title: "Power Vinyasa",teacher: "Raj Kumar",    dateTime: "Fri 11:00 AM",      style: "Power", spots: 2 },
        ].map(c => (
          <div key={c.title} className="flex justify-between items-center border-b border-gray-800 pb-3 last:border-0 last:pb-0">
            <div>
              <div className="text-sm font-medium">{c.title} <span className="text-gray-500 text-xs">· {c.style}</span></div>
              <div className="text-xs text-gray-400 mt-0.5">{c.teacher}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">{c.dateTime}</div>
              <div className="text-xs text-green-400 mt-0.5">{c.spots} spots left</div>
            </div>
          </div>
        ))}
      </div>
      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/booking",       label: "Book a Class",  icon: "📅" },
          { href: "/ai/coach",      label: "AI Flow Coach", icon: "✨" },
          { href: "/wellness",      label: "Log Wellness",  icon: "💚" },
          { href: "/student/history",label:"My History",    icon: "📊" },
        ].map(l => (
          <Link key={l.href} href={l.href} className="bg-gray-900 hover:bg-gray-800 rounded-2xl p-4 text-center transition-colors">
            <div className="text-2xl mb-1">{l.icon}</div>
            <div className="text-xs font-medium">{l.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function WellnessTab() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <StatCard label="Wellness Score" value={74}   unit="/100" color="teal" />
        <StatCard label="Sleep (avg)"    value={7.2}  unit="h"    color="blue" />
        <StatCard label="Water (today)"  value={2.1}  unit="L"    color="blue" />
        <StatCard label="Heart Rate"     value={68}   unit="bpm"  color="rose" />
        <StatCard label="Steps Today"    value="6,240"            color="green" />
        <StatCard label="Mood Today"     value="4"    unit="/5"   color="purple" />
      </div>
      <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Daily Progress</h2>
        {[
          { label: "Sleep Goal (8h)",   value: 7.2, max: 8,   color: "bg-blue-500" },
          { label: "Water Goal (2.5L)", value: 2.1, max: 2.5, color: "bg-teal-500" },
          { label: "Steps Goal (8k)",   value: 6.24, max: 8,  color: "bg-green-500" },
          { label: "Active Minutes",    value: 45,  max: 60,  color: "bg-amber-500" },
        ].map(g => (
          <div key={g.label}>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{g.label}</span><span>{Math.round((g.value / g.max) * 100)}%</span>
            </div>
            <ProgressBar value={g.value} max={g.max} color={g.color} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 rounded-2xl p-4">
          <h3 className="text-xs text-gray-400 mb-3">Sleep — Last 7 Nights</h3>
          <div className="flex items-end gap-1 h-12">
            {[7.0, 6.5, 8.0, 7.5, 7.2, 6.8, 7.2].map((v, i) => (
              <div key={i} className="flex-1 bg-blue-500 rounded-t" style={{ height: `${(v / 9) * 100}%` }} />
            ))}
          </div>
        </div>
        <div className="bg-gray-900 rounded-2xl p-4">
          <h3 className="text-xs text-gray-400 mb-3">Mood — Last 7 Days</h3>
          <div className="flex items-end gap-1 h-12">
            {[3, 4, 4, 5, 3, 4, 4].map((v, i) => (
              <div key={i} className="flex-1 bg-purple-500 rounded-t" style={{ height: `${(v / 5) * 100}%` }} />
            ))}
          </div>
        </div>
      </div>
      <Link href="/wellness" className="block bg-teal-900 hover:bg-teal-800 border border-teal-700 rounded-2xl p-4 text-center text-sm font-medium text-teal-300 transition-colors">Log Today's Wellness →</Link>
    </div>
  );
}

function BookingsTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="This Month"    value={18}  color="green" />
        <StatCard label="Cancelled"     value={2}   color="amber" />
        <StatCard label="Waitlisted"    value={1}   color="purple" />
      </div>
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Recent Bookings</h2>
        {[
          { class: "Morning Flow",   date: "Aug 5",  status: "attended",  teacher: "Priya S." },
          { class: "Yin Restore",    date: "Aug 3",  status: "attended",  teacher: "Anita M." },
          { class: "Power Vinyasa",  date: "Aug 1",  status: "cancelled", teacher: "Raj K." },
          { class: "Meditation",     date: "Jul 30", status: "attended",  teacher: "Meera T." },
        ].map((b, i) => (
          <div key={i} className="flex justify-between items-center py-2.5 border-b border-gray-800 last:border-0">
            <div>
              <div className="text-sm font-medium">{b.class}</div>
              <div className="text-xs text-gray-500">{b.teacher} · {b.date}</div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "attended" ? "bg-green-900 text-green-400" : "bg-amber-900 text-amber-400"}`}>{b.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function JourneyTab() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Day Streak"    value={12}   unit="d"     color="amber" />
        <StatCard label="Best Streak"   value={21}   unit="d"     color="amber" />
        <StatCard label="Phase"         value="Intermediate"      color="teal" />
        <StatCard label="Goals Active"  value={3}                 color="purple" />
      </div>
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-1">Current Phase</h2>
        <div className="text-xs text-gray-500 mb-3">Intermediate → Advanced in 18 more classes</div>
        <ProgressBar value={42} max={60} color="bg-teal-500" />
        <div className="flex justify-between text-xs text-gray-600 mt-1"><span>42 sessions</span><span>60 needed</span></div>
      </div>
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Active Goals</h2>
        {[
          { goal: "Stress Relief",    progress: 70 },
          { goal: "Flexibility",      progress: 55 },
          { goal: "Morning Practice", progress: 80 },
        ].map(g => (
          <div key={g.goal} className="mb-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1"><span>{g.goal}</span><span>{g.progress}%</span></div>
            <ProgressBar value={g.progress} max={100} color="bg-purple-500" />
          </div>
        ))}
      </div>
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Streak Calendar — Aug 2026</h2>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
            <div key={d} className={`text-center text-xs py-1 rounded ${d <= 5 ? "bg-amber-500 text-black font-bold" : d <= 12 ? "bg-amber-800 text-amber-200" : "bg-gray-800 text-gray-600"}`}>{d}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WalletTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Wallet Balance"     value="$24.50"          color="green" />
        <StatCard label="XP Points"          value={2840}            color="purple" />
        <StatCard label="Referral Credits"   value="$20"             color="teal" />
        <StatCard label="Active Vouchers"    value={2}               color="amber" />
      </div>
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Active Vouchers & Coupons</h2>
        {[
          { code: "REFER20",   desc: "Referral reward",    value: "$20 off",  exp: "Aug 31" },
          { code: "STREAK10",  desc: "12-day streak bonus", value: "10% off", exp: "Sep 15" },
        ].map(v => (
          <div key={v.code} className="flex justify-between items-center py-2.5 border-b border-gray-800 last:border-0">
            <div>
              <span className="font-mono text-green-400 text-sm">{v.code}</span>
              <div className="text-xs text-gray-500">{v.desc}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-amber-400">{v.value}</div>
              <div className="text-xs text-gray-600">Exp: {v.exp}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-1">Referral Code</h2>
        <div className="flex items-center gap-3 mt-2">
          <span className="font-mono text-xl text-purple-400">AARAV2026</span>
          <button className="text-xs bg-purple-900 text-purple-300 px-3 py-1.5 rounded-lg hover:bg-purple-800">Copy</button>
          <button className="text-xs bg-gray-800 text-gray-400 px-3 py-1.5 rounded-lg hover:bg-gray-700">Share</button>
        </div>
        <div className="text-xs text-gray-500 mt-2">You and your friend each get $20 credit when they complete their first class.</div>
      </div>
    </div>
  );
}

function AchievementsTab() {
  const badges = [
    { name: "First Class",    icon: "🧘", earned: true,  date: "Jul 1" },
    { name: "7-Day Streak",   icon: "🔥", earned: true,  date: "Jul 8" },
    { name: "10 Classes",     icon: "🌟", earned: true,  date: "Jul 15" },
    { name: "Morning Yogi",   icon: "🌅", earned: true,  date: "Jul 20" },
    { name: "Referral Star",  icon: "⭐", earned: true,  date: "Aug 1" },
    { name: "30-Day Streak",  icon: "💎", earned: false, date: "18 days to go" },
    { name: "50 Classes",     icon: "🏆", earned: false, date: "32 classes to go" },
    { name: "Yin Master",     icon: "🌊", earned: false, date: "5 Yin classes to go" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Badges Earned" value={5}   color="amber" />
        <StatCard label="XP Level"      value={14}  color="purple" />
        <StatCard label="XP to Next"    value={160} color="teal" />
      </div>
      <ProgressBar value={2840} max={3000} color="bg-purple-500" />
      <div className="text-xs text-gray-500 text-right">2,840 / 3,000 XP to Level 15</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {badges.map(b => (
          <div key={b.name} className={`rounded-2xl p-4 text-center ${b.earned ? "bg-amber-900 border border-amber-700" : "bg-gray-900 opacity-50"}`}>
            <div className="text-3xl mb-1">{b.icon}</div>
            <div className="text-xs font-semibold">{b.name}</div>
            <div className="text-xs text-gray-400 mt-0.5">{b.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudentDashboardPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Welcome back, Aarav — 12-day streak! Keep it up.</p>
        </div>
        <div className="border-b border-gray-800 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? "border-green-500 text-green-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}>{t}</button>
          ))}
        </div>
        {tab === "Overview"      && <OverviewTab />}
        {tab === "Wellness"      && <WellnessTab />}
        {tab === "Bookings"      && <BookingsTab />}
        {tab === "Journey"       && <JourneyTab />}
        {tab === "Wallet"        && <WalletTab />}
        {tab === "Achievements"  && <AchievementsTab />}
      </div>
    </div>
  );
}
