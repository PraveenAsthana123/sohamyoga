'use client';
// /customer/pose-mastery — read-only view of real teacher-assessed
// pose_assessment rows, plus a real bar-chart report of the mastery-level
// distribution (pure SVG, no charting dependency, computed from actual
// assessment counts — never a placeholder distribution).

import { useEffect, useState } from 'react';

interface Assessment { mastery_level: string; teacher_notes: string | null; assessed_at: string; sanskrit_name: string; english_name: string }
const LEVELS = ['exploring', 'learning', 'practising', 'proficient', 'master'];
const LEVEL_COLOR: Record<string, string> = { exploring: '#f59e0b', learning: '#eab308', practising: '#84cc16', proficient: '#22c55e', master: '#16a34a' };

export default function PoseMasteryPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [report, setReport] = useState<Record<string, number>>({});
  const [hasStudentRecord, setHasStudentRecord] = useState(true);

  useEffect(() => {
    fetch('/api/customer/pose-mastery', { cache: 'no-store' }).then(r => r.json()).then(d => {
      setAssessments(d.assessments ?? []); setReport(d.report ?? {}); setHasStudentRecord(d.hasStudentRecord);
    });
  }, []);

  if (!hasStudentRecord) return <p className="text-sm text-gray-500">Pose assessments appear here once your teacher assesses you.</p>;
  const max = Math.max(1, ...Object.values(report));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pose Mastery</h1>
        <p className="mt-1 text-sm text-gray-500">Real teacher assessments of your pose progression.</p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-600">Mastery distribution</h2>
        <svg viewBox="0 0 300 120" className="w-full" role="img" aria-label="Bar chart of pose mastery levels">
          {LEVELS.map((level, i) => {
            const value = report[level] ?? 0;
            const barHeight = (value / max) * 80;
            const x = i * 60 + 10;
            return (
              <g key={level}>
                <rect x={x} y={100 - barHeight} width={40} height={barHeight} fill={LEVEL_COLOR[level]} rx={3} />
                <text x={x + 20} y={112} fontSize="8" textAnchor="middle" fill="#6b7280">{level.slice(0, 6)}</text>
                <text x={x + 20} y={100 - barHeight - 4} fontSize="9" textAnchor="middle" fill="#374151">{value}</text>
              </g>
            );
          })}
        </svg>
      </section>

      <div className="space-y-2">
        {assessments.map((a, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{a.english_name} <span className="text-gray-400">({a.sanskrit_name})</span></span>
              <span className="rounded-full px-2 py-0.5 text-xs text-white" style={{ background: LEVEL_COLOR[a.mastery_level] }}>{a.mastery_level}</span>
            </div>
            {a.teacher_notes && <p className="mt-1 text-xs text-gray-500">{a.teacher_notes}</p>}
          </div>
        ))}
        {!assessments.length && <p className="text-sm text-gray-400">No pose assessments yet.</p>}
      </div>
    </div>
  );
}
