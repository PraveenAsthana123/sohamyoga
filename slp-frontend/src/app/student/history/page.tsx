"use client";

const HISTORY = [
  { date: "Aug 6", title: "Yin & Restore", teacher: "Anita Mehta", duration: 90, style: "Yin", poseScore: 88 },
  { date: "Aug 5", title: "Morning Flow", teacher: "Priya Sharma", duration: 60, style: "Hatha", poseScore: 91 },
  { date: "Aug 4", title: "Power Vinyasa", teacher: "Raj Patel", duration: 75, style: "Vinyasa", poseScore: 79 },
  { date: "Aug 3", title: "Yin & Restore", teacher: "Anita Mehta", duration: 90, style: "Yin", poseScore: 68 },
  { date: "Aug 2", title: "Morning Flow", teacher: "Priya Sharma", duration: 60, style: "Hatha", poseScore: 85 },
  { date: "Aug 1", title: "Power Vinyasa", teacher: "Raj Patel", duration: 75, style: "Vinyasa", poseScore: 72 },
];

export default function StudentHistoryPage() {
  const totalMin = HISTORY.reduce((a, s) => a + s.duration, 0);
  const avgScore = Math.round(HISTORY.reduce((a, s) => a + s.poseScore, 0) / HISTORY.length);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Class History</h1>
          <p className="text-gray-400 mt-1">{HISTORY.length} sessions · {totalMin} min total · avg score {avgScore}</p>
        </div>

        <div className="space-y-3">
          {HISTORY.map((s, i) => (
            <div key={i} className="bg-gray-900 rounded-2xl p-5 flex justify-between items-center">
              <div>
                <div className="font-semibold">{s.title}</div>
                <div className="text-sm text-gray-400">👩‍🏫 {s.teacher} · {s.style} · {s.duration} min</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.date}</div>
              </div>
              <div className={`text-2xl font-bold ${s.poseScore >= 80 ? "text-green-400" : s.poseScore >= 65 ? "text-yellow-400" : "text-red-400"}`}>
                {s.poseScore}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
