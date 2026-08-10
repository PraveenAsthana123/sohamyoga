"use client";
import { useState } from "react";
import { FeatureGate } from "@/components/features/FeatureGate";

// --- Static demo data matching domain models ---
const TEACHER = {
  id: "t1", firstName: "Sunita", lastName: "Patel",
  email: "sunita@sohamyoga.com", phone: "+1-416-555-0100",
  bio: "20 years of teaching Hatha, Yin, and Restorative yoga. Trained in Mysore, India.",
  timezone: "America/Toronto", status: "active", contractType: "employee",
  hireDate: "2022-01-15", department: "Yoga Instruction", designation: "Lead Teacher",
  hourlyRate: 45, currency: "CAD",
  specializations: ["Hatha", "Yin", "Restorative"],
  yearsTeaching: 20, avgStudentRating: 4.9, totalClassesTaught: 312, totalStudents: 84,
  canTeachOnline: true, canTeachKids: false, canTeachPrenatal: true,
  languages: ["English", "Hindi"],
  frappeEmployeeId: "EMP-00042", calcomUserId: "calcom_u_sunita", moodleUserId: "moodle_u_sunita",
  cpd_hoursThisYear: 8,
  certifications: [
    { name: "RYT-500", issuingBody: "Yoga Alliance", issueDate: "2018-03-10", verified: true },
    { name: "Prenatal Yoga", issuingBody: "IYTA",          issueDate: "2021-06-01", expiryDate: "2027-06-01", verified: true },
    { name: "CPR/AED",       issuingBody: "Red Cross",      issueDate: "2025-01-10", expiryDate: "2027-01-10", verified: true },
  ],
};

const PERFORMANCE = {
  period: "Monthly (Aug 2026)",
  totalScheduledClasses: 20, totalCompletedClasses: 18, totalCancelledClasses: 2,
  avgStudentRating: 4.9, npsScore: 72, totalRevenue: 3600,
  retentionRate: 86, uniqueStudents: 40, newStudents: 8,
};

const ATTENDANCE = [
  { date: "2026-08-28", class: "Morning Hatha Flow",    status: "present", checkIn: "08:58", duration: 62 },
  { date: "2026-08-26", class: "Yin & Restore",         status: "present", checkIn: "09:01", duration: 90 },
  { date: "2026-08-24", class: "Prenatal Gentle Flow",  status: "late",    checkIn: "09:09", duration: 58 },
  { date: "2026-08-21", class: "Evening Hatha",         status: "present", checkIn: "18:02", duration: 60 },
  { date: "2026-08-19", class: "Morning Hatha Flow",    status: "absent",  checkIn: "-",     duration: 0  },
];

const DOCUMENTS = [
  { id: 101, name: "RYT-500 Certificate",        type: "teacher_certification", date: "2018-03-10", status: "signed" },
  { id: 102, name: "Prenatal Yoga Certificate",  type: "teacher_certification", date: "2021-06-01", status: "signed" },
  { id: 103, name: "Employment Contract",        type: "contract",              date: "2022-01-15", status: "signed" },
  { id: 104, name: "CPR/AED Certificate",        type: "teacher_certification", date: "2025-01-10", status: "signed" },
  { id: 105, name: "Liability Insurance",        type: "insurance_document",    date: "2026-01-01", status: "issued" },
];

const HR = {
  leaveBalances: [
    { type: "annual", entitled: 15, used: 5, remaining: 10 },
    { type: "sick",   entitled: 10, used: 2, remaining: 8  },
  ],
  cpd_hoursRequired: 20, cpd_hoursCompleted: 8,
  lastAppraisal: "2026-01-15", nextAppraisal: "2026-07-15",
  hireDate: "2022-01-15",
};

const TABS = ["Overview", "Schedule", "Attendance", "Performance", "Documents", "HR & Payroll"] as const;
type Tab = typeof TABS[number];

const STATUS_COLOR: Record<string, string> = {
  present: "bg-green-100 text-green-700",
  late:    "bg-yellow-100 text-yellow-700",
  absent:  "bg-red-100 text-red-700",
  active:  "bg-green-100 text-green-700",
  signed:  "bg-blue-100 text-blue-700",
  issued:  "bg-purple-100 text-purple-700",
};

function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${color ?? "bg-gray-100 text-gray-700"}`}>
      {label}
    </span>
  );
}

function ProgressBar({ value, max = 100, color = "bg-blue-500" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function TeacherDetailPage({ params }: { params: { id: string } }) {
  const [tab, setTab] = useState<Tab>("Overview");

  const cpdPct = Math.round((HR.cpd_hoursCompleted / HR.cpd_hoursRequired) * 100);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-6 mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shrink-0">
          {TEACHER.firstName[0]}{TEACHER.lastName[0]}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{TEACHER.firstName} {TEACHER.lastName}</h1>
          <p className="text-gray-500">{TEACHER.designation} — {TEACHER.department}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge label={TEACHER.status}        color={STATUS_COLOR[TEACHER.status]} />
            <Badge label={TEACHER.contractType}  />
            {TEACHER.specializations.map(s => <Badge key={s} label={s} color="bg-indigo-100 text-indigo-700" />)}
          </div>
          <div className="flex gap-6 mt-3 text-sm text-gray-600">
            <span>⭐ {TEACHER.avgStudentRating} avg</span>
            <span>🧘 {TEACHER.totalClassesTaught} classes</span>
            <span>👥 {TEACHER.totalStudents} students</span>
            <span>📅 {TEACHER.yearsTeaching} yrs exp</span>
          </div>
        </div>
        {/* External IDs */}
        <div className="flex flex-col gap-1 text-xs text-right text-gray-400">
          {TEACHER.frappeEmployeeId && <span>ERPNext: {TEACHER.frappeEmployeeId}</span>}
          {TEACHER.calcomUserId      && <span>Cal.com: {TEACHER.calcomUserId}</span>}
          {TEACHER.moodleUserId      && <span>Moodle: {TEACHER.moodleUserId}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >{t}</button>
        ))}
      </div>

      {/* Overview */}
      {tab === "Overview" && (
        <div className="space-y-6">
          <div className="bg-white border rounded-lg p-5">
            <h2 className="font-semibold text-gray-800 mb-2">Biography</h2>
            <p className="text-gray-600 text-sm">{TEACHER.bio}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border rounded-lg p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Contact & Details</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Email</dt><dd>{TEACHER.email}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Phone</dt><dd>{TEACHER.phone}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Timezone</dt><dd>{TEACHER.timezone}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Languages</dt><dd>{TEACHER.languages.join(", ")}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Hire Date</dt><dd>{TEACHER.hireDate}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Hourly Rate</dt><dd>{TEACHER.currency} {TEACHER.hourlyRate}</dd></div>
              </dl>
            </div>
            <div className="bg-white border rounded-lg p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Teaching Capabilities</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Online Classes</span><span>{TEACHER.canTeachOnline ? "✅ Yes" : "No"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Kids Classes</span><span>{TEACHER.canTeachKids ? "✅ Yes" : "No"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Prenatal Classes</span><span>{TEACHER.canTeachPrenatal ? "✅ Yes" : "No"}</span></div>
              </div>
            </div>
          </div>
          <div className="bg-white border rounded-lg p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Certifications</h2>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500 text-left">
                <th className="pb-2">Certificate</th><th className="pb-2">Issuing Body</th>
                <th className="pb-2">Issued</th><th className="pb-2">Expires</th><th className="pb-2">Status</th>
              </tr></thead>
              <tbody>{TEACHER.certifications.map((c, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="py-2 text-gray-500">{c.issuingBody}</td>
                  <td className="py-2 text-gray-500">{c.issueDate}</td>
                  <td className="py-2 text-gray-500">{c.expiryDate ?? "—"}</td>
                  <td className="py-2"><Badge label={c.verified ? "Verified" : "Pending"} color={c.verified ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedule */}
      {tab === "Schedule" && (
        <FeatureGate flag="integration.calcom">
          <div className="bg-white border rounded-lg p-8 text-center">
            <div className="text-5xl mb-3">📅</div>
            <p className="font-semibold text-gray-800">Cal.com Schedule</p>
            <p className="text-sm text-gray-500 mt-1">Availability, blocked periods, and upcoming bookings sync from Cal.com</p>
            <a href={`http://localhost:3100`} target="_blank" rel="noreferrer"
               className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
              Open Cal.com for {TEACHER.firstName}
            </a>
          </div>
        </FeatureGate>
      )}

      {/* Attendance */}
      {tab === "Attendance" && (
        <FeatureGate flag="teacher.qr_attendance">
          <div className="bg-white border rounded-lg p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Recent Attendance</h2>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-gray-500 text-left">
                <th className="pb-2">Date</th><th className="pb-2">Class</th>
                <th className="pb-2">Check-in</th><th className="pb-2">Duration</th><th className="pb-2">Status</th>
              </tr></thead>
              <tbody>{ATTENDANCE.map((a, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 text-gray-500">{a.date}</td>
                  <td className="py-2 font-medium">{a.class}</td>
                  <td className="py-2 text-gray-500">{a.checkIn}</td>
                  <td className="py-2 text-gray-500">{a.duration > 0 ? `${a.duration} min` : "—"}</td>
                  <td className="py-2"><Badge label={a.status} color={STATUS_COLOR[a.status]} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </FeatureGate>
      )}

      {/* Performance */}
      {tab === "Performance" && (
        <FeatureGate flag="teacher.performance_analytics">
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Period: {PERFORMANCE.period}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Classes Completed", value: `${PERFORMANCE.totalCompletedClasses}/${PERFORMANCE.totalScheduledClasses}` },
                { label: "Avg Rating",         value: `⭐ ${PERFORMANCE.avgStudentRating}` },
                { label: "NPS Score",          value: PERFORMANCE.npsScore },
                { label: "Revenue",            value: `CAD ${PERFORMANCE.totalRevenue.toLocaleString()}` },
              ].map(k => (
                <div key={k.label} className="bg-white border rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-indigo-600">{k.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{k.label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border rounded-lg p-5">
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-gray-600">Completion Rate</span>
                  <span className="font-medium">{Math.round((PERFORMANCE.totalCompletedClasses/PERFORMANCE.totalScheduledClasses)*100)}%</span>
                </div>
                <ProgressBar value={PERFORMANCE.totalCompletedClasses} max={PERFORMANCE.totalScheduledClasses} color="bg-green-500" />
              </div>
              <div className="bg-white border rounded-lg p-5">
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-gray-600">Student Retention</span>
                  <span className="font-medium">{PERFORMANCE.retentionRate}%</span>
                </div>
                <ProgressBar value={PERFORMANCE.retentionRate} color="bg-blue-500" />
              </div>
            </div>
            <div className="bg-white border rounded-lg p-5 text-center text-gray-500 text-sm">
              <p className="font-medium mb-1">Full Analytics</p>
              <p>Detailed charts available in <a href="http://localhost:3001" target="_blank" rel="noreferrer" className="text-indigo-600 underline">Metabase</a> and <a href="#" className="text-indigo-600 underline">PostHog</a></p>
            </div>
          </div>
        </FeatureGate>
      )}

      {/* Documents */}
      {tab === "Documents" && (
        <div className="bg-white border rounded-lg p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-800">Certificates & Documents</h2>
            <a href="http://localhost:8010" target="_blank" rel="noreferrer"
               className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700">
              Open Paperless-ngx
            </a>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500 text-left">
              <th className="pb-2">Document</th><th className="pb-2">Type</th>
              <th className="pb-2">Date</th><th className="pb-2">Status</th>
            </tr></thead>
            <tbody>{DOCUMENTS.map(d => (
              <tr key={d.id} className="border-b last:border-0">
                <td className="py-2 font-medium">{d.name}</td>
                <td className="py-2 text-gray-500">{d.type.replace(/_/g, " ")}</td>
                <td className="py-2 text-gray-500">{d.date}</td>
                <td className="py-2"><Badge label={d.status} color={STATUS_COLOR[d.status] ?? "bg-gray-100 text-gray-700"} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* HR & Payroll */}
      {tab === "HR & Payroll" && (
        <FeatureGate flag="teacher.payroll_view">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border rounded-lg p-5">
                <h2 className="font-semibold text-gray-800 mb-3">Leave Balances</h2>
                {HR.leaveBalances.map(lb => (
                  <div key={lb.type} className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-gray-600">{lb.type}</span>
                      <span className="font-medium">{lb.remaining}/{lb.entitled} days</span>
                    </div>
                    <ProgressBar value={lb.remaining} max={lb.entitled} color="bg-teal-500" />
                  </div>
                ))}
              </div>
              <div className="bg-white border rounded-lg p-5">
                <h2 className="font-semibold text-gray-800 mb-3">CPD Progress</h2>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Continuing Professional Development</span>
                  <span className="font-medium">{HR.cpd_hoursCompleted}/{HR.cpd_hoursRequired} hrs</span>
                </div>
                <ProgressBar value={HR.cpd_hoursCompleted} max={HR.cpd_hoursRequired} color={cpdPct >= 80 ? "bg-green-500" : cpdPct >= 50 ? "bg-yellow-500" : "bg-red-500"} />
                <p className="text-xs text-gray-500 mt-2">{HR.cpd_hoursRequired - HR.cpd_hoursCompleted} hours remaining this year</p>
              </div>
            </div>
            <div className="bg-white border rounded-lg p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Appraisal Schedule</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-gray-500">Last Appraisal</dt><dd className="font-medium">{HR.lastAppraisal}</dd></div>
                <div><dt className="text-gray-500">Next Appraisal</dt><dd className="font-medium text-amber-600">{HR.nextAppraisal}</dd></div>
              </dl>
            </div>
            <div className="bg-white border rounded-lg p-5 text-center text-sm text-gray-500">
              <p className="font-medium mb-1">Payslips & Payroll</p>
              <a href="http://localhost:8080" target="_blank" rel="noreferrer" className="text-indigo-600 underline">Open ERPNext / Frappe HR</a>
            </div>
          </div>
        </FeatureGate>
      )}
    </div>
  );
}
