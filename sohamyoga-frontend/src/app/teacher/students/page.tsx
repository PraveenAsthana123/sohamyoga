"use client";
import { useState } from "react";

const STUDENTS = [
  { id: 1, name: "Aisha Patel", email: "aisha@example.com", level: "Beginner", sessions: 12, lastClass: "Aug 4", avgScore: 74, membership: "Monthly" },
  { id: 2, name: "Marcus Chen", email: "marcus@example.com", level: "Intermediate", sessions: 28, lastClass: "Aug 5", avgScore: 82, membership: "Annual" },
  { id: 3, name: "Sofia Rodriguez", email: "sofia@example.com", level: "Beginner", sessions: 5, lastClass: "Aug 3", avgScore: 69, membership: "Monthly" },
  { id: 4, name: "James O'Brien", email: "james@example.com", level: "Advanced", sessions: 64, lastClass: "Aug 6", avgScore: 91, membership: "Annual" },
  { id: 5, name: "Yuki Tanaka", email: "yuki@example.com", level: "Intermediate", sessions: 19, lastClass: "Aug 2", avgScore: 78, membership: "Free" },
];

export default function TeacherStudentsPage() {
  const [search, setSearch] = useState("");
  const filtered = STUDENTS.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Students</h1>
          <p className="text-gray-400 mt-1">{STUDENTS.length} students enrolled in your classes</p>
        </div>

        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500" />

        <div className="bg-gray-900 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="p-4">Student</th>
                <th className="p-4">Level</th>
                <th className="p-4">Sessions</th>
                <th className="p-4">Last Class</th>
                <th className="p-4">Avg Score</th>
                <th className="p-4">Plan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                  <td className="p-4">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-gray-400 text-xs">{s.email}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      s.level === "Beginner" ? "bg-green-900 text-green-300" :
                      s.level === "Intermediate" ? "bg-yellow-900 text-yellow-300" :
                      "bg-red-900 text-red-300"
                    }`}>{s.level}</span>
                  </td>
                  <td className="p-4">{s.sessions}</td>
                  <td className="p-4 text-gray-400">{s.lastClass}</td>
                  <td className="p-4">
                    <span className={`font-bold ${s.avgScore >= 80 ? "text-green-400" : s.avgScore >= 65 ? "text-yellow-400" : "text-red-400"}`}>
                      {s.avgScore}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-purple-900 text-purple-300">{s.membership}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
