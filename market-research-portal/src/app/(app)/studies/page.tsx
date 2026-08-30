'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Study { id: string; topicName: string; status: string; createdAt: string }

export default function StudiesPage() {
  const [studies, setStudies] = useState<Study[]>([]);

  useEffect(() => {
    fetch('/api/studies', { cache: 'no-store' }).then(r => r.json()).then(d => setStudies(d.studies ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Studies</h1>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Topic</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {studies.map(s => (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="px-4 py-2">
                  <Link href={`/studies/${s.id}/phases/population`} className="text-brand-700 hover:underline">{s.topicName}</Link>
                </td>
                <td className="px-4 py-2 text-gray-600">{s.status}</td>
                <td className="px-4 py-2 text-gray-400">{new Date(s.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {!studies.length && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">No studies yet — start one from Master Pipeline.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
