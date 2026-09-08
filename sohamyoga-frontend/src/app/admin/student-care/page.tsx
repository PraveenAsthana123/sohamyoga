'use client';
// Real staff visibility into student_goal + student_guardian -- previously
// zero admin surface existed for either (found live during the 2026-09-01
// admin-panel gap audit). Emergency contacts especially: a real safety gap,
// since this data is meant to matter during an actual in-class incident.

import { useEffect, useState } from 'react';

interface Goal { student_id: string; student_name: string; goal_code: string; label: string; priority: number; set_at: string }
interface Contact { id: string; student_id: string; student_name: string; guardian_name: string; relationship: string; phone: string | null; email: string | null; is_emergency: boolean; created_at: string }

export default function StudentCarePage() {
  const [tab, setTab] = useState<'contacts' | 'goals'>('contacts');
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/emergency-contacts', { cache: 'no-store' }).then(r => r.json()).then(d => setContacts(d.contacts ?? []));
    fetch('/api/admin/student-goals', { cache: 'no-store' }).then(r => r.json()).then(d => setGoals(d.goals ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Student Care</h1>
        <p className="mt-1 text-sm text-gray-500">Staff visibility into emergency contacts and structured practice goals — both customer-authored, both previously invisible to staff.</p>
      </header>

      <div className="flex gap-2 border-b">
        <button onClick={() => setTab('contacts')} className={`px-3 py-2 text-sm font-medium ${tab === 'contacts' ? 'border-b-2 border-red-600 text-red-700' : 'text-gray-500'}`}>
          Emergency Contacts {contacts ? `(${contacts.length})` : ''}
        </button>
        <button onClick={() => setTab('goals')} className={`px-3 py-2 text-sm font-medium ${tab === 'goals' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500'}`}>
          Practice Goals {goals ? `(${goals.length})` : ''}
        </button>
      </div>

      {tab === 'contacts' && (
        <div className="app-card">
          {!contacts && <p className="text-sm text-gray-400">Loading…</p>}
          {contacts && !contacts.length && <p className="text-sm text-gray-400">No emergency contacts recorded yet.</p>}
          <div className="space-y-2">
            {contacts?.map(c => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm">
                <div>
                  <div className="font-medium">{c.student_name} → {c.guardian_name} <span className="text-gray-400 capitalize">({c.relationship})</span></div>
                  <div className="text-xs text-gray-500">{c.phone || '—'} {c.email ? `· ${c.email}` : ''}</div>
                </div>
                {c.is_emergency && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Emergency</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'goals' && (
        <div className="app-card">
          {!goals && <p className="text-sm text-gray-400">Loading…</p>}
          {goals && !goals.length && <p className="text-sm text-gray-400">No goals set yet.</p>}
          <div className="space-y-2">
            {goals?.map((g, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm">
                <span className="font-medium">{g.student_name}</span>
                <span className="text-gray-600">{g.label} <span className="text-xs text-gray-400">(priority {g.priority})</span></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
