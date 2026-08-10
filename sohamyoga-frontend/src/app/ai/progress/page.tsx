"use client";

const SESSIONS = [
  { date: "Aug 1", pose: "Warrior I", score: 72, duration: 45, style: "Hatha" },
  { date: "Aug 2", pose: "Tree Pose", score: 85, duration: 30, style: "Vinyasa" },
  { date: "Aug 3", pose: "Downward Dog", score: 68, duration: 60, style: "Yin" },
  { date: "Aug 4", pose: "Warrior II", score: 79, duration: 45, style: "Hatha" },
  { date: "Aug 5", pose: "Mountain Pose", score: 91, duration: 30, style: "Vinyasa" },
  { date: "Aug 6", pose: "Child's Pose", score: 88, duration: 60, style: "Yin" },
];

const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

export default function ProgressPage() {
  const scores = SESSIONS.map(s => s.score);
  const avgScore = avg(scores);
  const totalMin = SESSIONS.reduce((a, s) => a + s.duration, 0);
  const best = Math.max(...scores);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">My Progress</h1>
          <p className="text-gray-400 mt-1">AI pose scores and practice history</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Avg Pose Score", value: `${avgScore}`, unit: "/ 100" },
            { label: "Total Practice", value: `${totalMin}`, unit: "min" },
            { label: "Best Score", value: `${best}`, unit: "/ 100" },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 rounded-2xl p-5 text-center">
              <div className="text-3xl font-bold text-green-400">{s.value}<span className="text-sm text-gray-500 font-normal"> {s.unit}</span></div>
              <div className="text-sm text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Score chart (CSS bar chart) */}
        <div className="bg-gray-900 rounded-2xl p-6">
          <h2 className="font-semibold mb-4 text-gray-300">Pose Score Trend</h2>
          <div className="flex items-end gap-3 h-32">
            {SESSIONS.map(s => (
              <div key={s.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-xs text-gray-400">{s.score}</div>
                <div className="w-full rounded-t-sm bg-green-600 transition-all"
                     style={{ height: `${(s.score / 100) * 100}%` }} />
                <div className="text-xs text-gray-500">{s.date}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Session history */}
        <div className="bg-gray-900 rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold text-gray-300">Recent Sessions</h2>
          {SESSIONS.slice().reverse().map(s => (
            <div key={s.date} className="flex justify-between items-center border-b border-gray-800 pb-3 last:border-0 last:pb-0">
              <div>
                <div className="font-medium">{s.pose}</div>
                <div className="text-sm text-gray-400">{s.date} · {s.style} · {s.duration} min</div>
              </div>
              <div className={`text-xl font-bold ${s.score >= 80 ? "text-green-400" : s.score >= 65 ? "text-yellow-400" : "text-red-400"}`}>
                {s.score}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
