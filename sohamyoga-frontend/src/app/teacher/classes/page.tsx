"use client";
import { useState } from "react";

const CLASSES = [
  { id: "1", title: "Morning Flow", style: "Hatha", level: "Beginner", day: "Mon/Wed/Fri", time: "7:00 AM", duration: 60, enrolled: 8, capacity: 15, price: 15 },
  { id: "2", title: "Power Vinyasa", style: "Vinyasa", level: "Intermediate", day: "Tue/Thu", time: "10:00 AM", duration: 75, enrolled: 12, capacity: 12, price: 18 },
  { id: "4", title: "Advanced Inversions", style: "Ashtanga", level: "Advanced", day: "Thu", time: "8:00 AM", duration: 60, enrolled: 5, capacity: 8, price: 22 },
];

export default function TeacherClassesPage() {
  const [classes] = useState(CLASSES);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">My Classes</h1>
            <p className="text-gray-400 mt-1">Manage your teaching schedule</p>
          </div>
          <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            + Add Class
          </button>
        </div>

        <div className="space-y-4">
          {classes.map(cls => (
            <div key={cls.id} className="bg-gray-900 rounded-2xl p-6 flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{cls.title}</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-purple-900 text-purple-300">{cls.style}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-green-900 text-green-300">{cls.level}</span>
                </div>
                <p className="text-gray-400 text-sm">📅 {cls.day} at {cls.time} · ⏱ {cls.duration} min · ${cls.price}/class</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-32 bg-gray-700 rounded-full h-1.5">
                    <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${(cls.enrolled / cls.capacity) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-400">{cls.enrolled}/{cls.capacity} enrolled</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">Edit</button>
                <button className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">Roster</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
