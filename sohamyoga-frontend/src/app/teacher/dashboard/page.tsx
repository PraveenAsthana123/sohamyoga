"use client";
import { useState } from "react";
import Link from "next/link";

const TABS = ["Overview", "Schedule", "Students", "Revenue", "Certifications", "Analytics"] as const;
type Tab = typeof TABS[number];

function StatCard({ label, value, unit, sub, color = "green" }: { label: string; value: string | number; unit?: string; sub?: string; color?: string }) {
  const c: Record<string, string> = { green: "text-green-400", blue: "text-blue-400", amber: "text-amber-400", purple: "text-purple-400", teal: "text-teal-400", rose: "text-rose-400" };
  return (
    <div className="bg-gray-900 rounded-2xl p-4 text-center">
      <div className={`text-2xl font-bold ${c[color] ?? c.green}`}>{value}{unit && <span className="text-sm font-normal ml-0.5">{unit}</span>}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, max, color = "bg-green-500" }: { value: number; max: number; color?: string }) {
  return (
    <div className="w-full h-1.5 bg-gray-800 rounded-full">
      <div className={`h-1.5 ${color} rounded-full`} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <StatCard label="Classes (Month)"  value={42}   color="green" />
        <StatCard label="Students"         value={384}  sub="Active"     color="blue" />
        <StatCard label="Avg Rating"       value="4.8"  unit="/5"        color="amber" />
        <StatCard label="Revenue (Aug)"    value="$8,400"               color="green" />
        <StatCard label="Utilization"      value={87}   unit="%"         color="teal" />
        <StatCard label="Cert Expiry"      value="3" unit="mo"   sub="Next: RYT 500" color="rose" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-gray-300">Upcoming Classes</h2>
            <Link href="/teacher/classes" className="text-green-400 text-xs hover:text-green-300">View all →</Link>
          </div>
          {[
            { title: "Morning Flow",  time: "Tomorrow 07:00", enrolled: 13, cap: 15 },
            { title: "Power Vinyasa", time: "Wed 11:00",      enrolled: 12, cap: 15 },
            { title: "Yin Restore",   time: "Fri 09:00",      enrolled: 10, cap: 12 },
          ].map(c => (
            <div key={c.title} className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{c.title}</span>
                <span className="text-gray-500 text-xs">{c.time}</span>
              </div>
              <div className="flex items-center gap-2">
                <ProgressBar value={c.enrolled} max={c.cap} color={c.enrolled >= c.cap ? "bg-red-500" : "bg-green-500"} />
                <span className="text-xs text-gray-500">{c.enrolled}/{c.cap}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-gray-900 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/teacher/classes",   label: "New Class",       icon: "📅" },
              { href: "/teacher/students",  label: "My Students",     icon: "👥" },
              { href: "/teacher/schedule",  label: "Availability",    icon: "🗓" },
              { href: "/ai/flow-generator", label: "AI Flow Builder", icon: "✨" },
            ].map(l => (
              <Link key={l.href} href={l.href} className="bg-gray-800 hover:bg-gray-700 rounded-xl p-3 flex items-center gap-2 text-sm transition-colors">
                <span>{l.icon}</span><span>{l.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleTab() {
  const today = [
    { time: "07:00", name: "Morning Flow",  booked: 13, cap: 15, status: "upcoming" },
    { time: "10:00", name: "Private — Aarav Shah", booked: 1, cap: 1, status: "confirmed" },
    { time: "17:00", name: "Evening Hatha", booked: 14, cap: 15, status: "upcoming" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Classes Today"    value={3}    color="green" />
        <StatCard label="Hours Today"      value={4.5}  unit="h" color="blue" />
        <StatCard label="Students Today"   value={28}   color="teal" />
      </div>
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Today — Tue Aug 5</h2>
        {today.map(c => (
          <div key={c.time} className="flex justify-between items-center py-3 border-b border-gray-800 last:border-0">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-gray-500 w-12">{c.time}</span>
              <div>
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs text-gray-500">{c.booked}/{c.cap} students</div>
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === "confirmed" ? "bg-blue-900 text-blue-300" : "bg-green-900 text-green-300"}`}>{c.status}</span>
          </div>
        ))}
      </div>
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Availability This Week</h2>
        <div className="grid grid-cols-7 gap-1">
          {[
            { d: "Mon", classes: 2, available: true },
            { d: "Tue", classes: 3, available: true },
            { d: "Wed", classes: 2, available: true },
            { d: "Thu", classes: 2, available: false },
            { d: "Fri", classes: 1, available: true },
            { d: "Sat", classes: 3, available: true },
            { d: "Sun", classes: 0, available: false },
          ].map(d => (
            <div key={d.d} className={`text-center rounded-lg py-2 ${!d.available ? "bg-gray-800 opacity-40" : d.classes > 2 ? "bg-green-900" : "bg-gray-800"}`}>
              <div className="text-xs text-gray-400">{d.d}</div>
              <div className="text-sm font-bold text-green-400 mt-1">{d.classes > 0 ? d.classes : "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StudentsTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Active Students"  value={384} color="blue" />
        <StatCard label="New (Month)"      value={24}  color="green" />
        <StatCard label="Avg Attendance"   value="82%" color="teal" />
      </div>
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Top Students (Aug)</h2>
        {[
          { name: "Aarav Shah",  classes: 18, streak: "12d", rating: "5/5" },
          { name: "Diya Patel",  classes: 14, streak: "7d",  rating: "5/5" },
          { name: "Riya Gupta",  classes: 12, streak: "4d",  rating: "4/5" },
          { name: "Kiran Mehta", classes: 10, streak: "2d",  rating: "4/5" },
          { name: "Priya Roy",   classes: 8,  streak: "0d",  rating: "5/5" },
        ].map(s => (
          <div key={s.name} className="flex justify-between items-center py-2.5 border-b border-gray-800 last:border-0">
            <span className="text-sm font-medium">{s.name}</span>
            <div className="flex gap-4 text-xs text-gray-400">
              <span>{s.classes} classes</span>
              <span>🔥 {s.streak}</span>
              <span>★ {s.rating}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RevenueTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Revenue (Aug)"     value="$8,400"  color="green" />
        <StatCard label="Commission Rate"   value="22%"     color="amber" />
        <StatCard label="Commission Due"    value="$1,848"  sub="Aug 31" color="purple" />
      </div>
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Monthly Revenue — 2026</h2>
        <div className="flex items-end gap-1.5 h-24">
          {[{m:"J",v:5200},{m:"F",v:5600},{m:"M",v:6100},{m:"A",v:6800},{m:"M",v:7200},{m:"J",v:6900},{m:"J",v:7600},{m:"A",v:8400}].map(({m,v}) => (
            <div key={m} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-green-500 rounded-t" style={{ height: `${(v / 9000) * 100}%` }} />
              <span className="text-xs text-gray-600">{m}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Revenue by Class Type</h2>
        {[["Morning Flow","$2,800",33],["Power Vinyasa","$2,400",29],["Private Sessions","$1,800",21],["Yin Restore","$900",11],["Workshop","$500",6]].map(([type,rev,pct]) => (
          <div key={String(type)} className="mb-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1"><span>{type}</span><span>{rev} ({pct}%)</span></div>
            <ProgressBar value={Number(pct)} max={100} color="bg-green-500" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CertificationsTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Active Certs"  value={4}          color="green" />
        <StatCard label="Expiring Soon" value={1}  sub="<90 days" color="amber" />
        <StatCard label="CPD Hours YTD" value={24} unit="h" color="blue" />
      </div>
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">My Certifications</h2>
        {[
          { name: "RYT 200",  org: "Yoga Alliance", expiry: "Dec 2027", status: "verified",  daysLeft: 510 },
          { name: "RYT 500",  org: "Yoga Alliance", expiry: "Nov 2026", status: "verified",  daysLeft: 88 },
          { name: "CPR/AED",  org: "St. John Ambulance", expiry: "Feb 2027", status: "verified", daysLeft: 180 },
          { name: "Prenatal", org: "RPYT",          expiry: "Mar 2027", status: "verified",  daysLeft: 210 },
        ].map(c => (
          <div key={c.name} className="flex justify-between items-center py-3 border-b border-gray-800 last:border-0">
            <div>
              <div className="text-sm font-medium">{c.name}</div>
              <div className="text-xs text-gray-500">{c.org} · Expires {c.expiry}</div>
            </div>
            <div className="text-right">
              <span className={`text-xs px-2 py-0.5 rounded-full ${c.daysLeft < 90 ? "bg-amber-900 text-amber-300" : "bg-green-900 text-green-300"}`}>{c.status}</span>
              <div className="text-xs text-gray-600 mt-0.5">{c.daysLeft}d remaining</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="NPS Score"       value={82}   sub="Excellent"    color="green" />
        <StatCard label="Cancellation Rate" value="4%" sub="↓ 1% vs Jul" color="teal" />
        <StatCard label="Occupancy Rate"  value="87%"                    color="amber" />
      </div>
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Rating Breakdown</h2>
        {[["5 stars",68],["4 stars",22],["3 stars",7],["2 stars",2],["1 star",1]].map(([label,pct]) => (
          <div key={String(label)} className="flex items-center gap-3 mb-2">
            <span className="text-xs text-gray-400 w-14">{label}</span>
            <ProgressBar value={Number(pct)} max={100} color="bg-amber-500" />
            <span className="text-xs text-gray-500 w-8">{pct}%</span>
          </div>
        ))}
      </div>
      <div className="bg-gray-900 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Attendance Trend</h2>
        <div className="flex items-end gap-1 h-16">
          {[78,82,80,88,85,90,87,94,91,96,93,98,95,101].map((v, i) => (
            <div key={i} className="flex-1 bg-teal-500 rounded-t" style={{ height: `${(v / 110) * 100}%` }} />
          ))}
        </div>
        <div className="text-xs text-gray-600 mt-1">Daily attendance — last 14 days</div>
      </div>
    </div>
  );
}

export default function TeacherDashboardPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">Welcome back, Priya — 42 classes this month</p>
          </div>
          <Link href="/teacher/classes" className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">+ New Class</Link>
        </div>
        <div className="border-b border-gray-800 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? "border-green-500 text-green-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}>{t}</button>
          ))}
        </div>
        {tab === "Overview"        && <OverviewTab />}
        {tab === "Schedule"        && <ScheduleTab />}
        {tab === "Students"        && <StudentsTab />}
        {tab === "Revenue"         && <RevenueTab />}
        {tab === "Certifications"  && <CertificationsTab />}
        {tab === "Analytics"       && <AnalyticsTab />}
      </div>
    </div>
  );
}
