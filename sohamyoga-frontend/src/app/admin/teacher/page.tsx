'use client';

import { useCallback, useEffect, useState } from 'react';

const TABS = ['Overview', 'Teacher List', 'Certifications', 'Schedules', 'Performance'] as const;
type Tab = typeof TABS[number];

interface Teacher {
  id: string; first_name: string; last_name: string; email: string; phone: string | null;
  bio: string | null; status: string; contract_type: string | null; specializations: string[] | null;
  hire_date: string | null; avg_rating: string | null; rating_count: number;
  total_sessions: number; upcoming_sessions: number;
}

interface Cert {
  teacher_id: string; certification_name: string; issuing_body: string | null;
  issued_at: string | null; expires_at: string | null; status: string | null;
}

interface Slot {
  teacher_id: string; day_of_week: number; start_time: string; end_time: string;
}

interface Summary { total: number; active: number; certifications: number; scheduleSlots: number; }

interface ApiData {
  teachers: Teacher[];
  certifications: Cert[];
  schedules: Slot[];
  summary: Summary;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function KpiCard({ label, value, color = 'blue' }: { label: string; value: string | number; color?: string }) {
  const c: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div className={`border rounded-lg p-4 ${c[color] ?? c.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
    </div>
  );
}

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = {
    green: 'bg-green-100 text-green-700', red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700', gray: 'bg-gray-100 text-gray-600',
    blue: 'bg-blue-100 text-blue-700',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c[color] ?? c.gray}`}>{children}</span>;
}

function statusColor(s: string) {
  return s === 'active' ? 'green' : s === 'inactive' ? 'gray' : s === 'suspended' ? 'red' : 'amber';
}

export default function TeacherPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/teacher', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: ApiData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (t: Teacher) => {
    const next = t.status === 'active' ? 'inactive' : 'active';
    setToggling(t.id);
    await fetch('/api/admin/teacher', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, status: next }),
    });
    setToggling(null);
    load();
  };

  const filtered = (data?.teachers ?? []).filter(t =>
    !search || `${t.first_name} ${t.last_name} ${t.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const s = data?.summary;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Teacher Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">Profiles, certifications, schedules and performance</p>
      </div>

      <div className="border-b flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading teacher data…</div>
      ) : (
        <>
          {tab === 'Overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Total Teachers" value={s?.total ?? 0} color="blue" />
                <KpiCard label="Active" value={s?.active ?? 0} color="green" />
                <KpiCard label="Certifications" value={s?.certifications ?? 0} color="purple" />
                <KpiCard label="Schedule Slots" value={s?.scheduleSlots ?? 0} color="amber" />
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Teacher Roster</h3>
                <div className="space-y-2">
                  {(data?.teachers ?? []).slice(0, 10).map(t => (
                    <div key={t.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                      <div>
                        <span className="font-medium">{t.first_name} {t.last_name}</span>
                        <span className="text-gray-400 text-xs ml-2">{t.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.avg_rating && <span className="text-xs text-amber-600">★ {t.avg_rating} ({t.rating_count})</span>}
                        <Badge color={statusColor(t.status)}>{t.status}</Badge>
                      </div>
                    </div>
                  ))}
                  {(data?.teachers ?? []).length === 0 && (
                    <p className="text-sm text-gray-400">No teachers registered yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'Teacher List' && (
            <div className="space-y-4">
              <input
                type="text" placeholder="Search teachers…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>{['Name', 'Email', 'Contract', 'Sessions', 'Rating', 'Status', 'Action'].map(h =>
                      <th key={h} className="px-3 py-2 text-left">{h}</th>
                    )}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="font-medium">{t.first_name} {t.last_name}</div>
                          {t.specializations?.length ? (
                            <div className="text-xs text-gray-400">{t.specializations.slice(0, 2).join(', ')}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{t.email}</td>
                        <td className="px-3 py-2">
                          {t.contract_type && <Badge>{t.contract_type.replace(/_/g, ' ')}</Badge>}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{t.total_sessions} ({t.upcoming_sessions} upcoming)</td>
                        <td className="px-3 py-2 text-amber-600 text-xs">
                          {t.avg_rating ? `★ ${t.avg_rating} (${t.rating_count})` : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <Badge color={statusColor(t.status)}>{t.status}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => toggleStatus(t)}
                            disabled={toggling === t.id}
                            className={`text-xs px-3 py-1 rounded font-medium ${t.status === 'active' ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                            {toggling === t.id ? '…' : t.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-sm">No teachers found.</div>
                )}
              </div>
            </div>
          )}

          {tab === 'Certifications' && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50">
                <h3 className="text-sm font-semibold">Teacher Certifications ({data?.certifications.length ?? 0})</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>{['Certification', 'Issuing Body', 'Issued', 'Expires', 'Status'].map(h =>
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  )}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.certifications ?? []).map((c, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{c.certification_name}</td>
                      <td className="px-3 py-2 text-gray-500">{c.issuing_body ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {c.issued_at ? new Date(c.issued_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'No expiry'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge color={c.status === 'active' ? 'green' : c.status === 'expired' ? 'red' : 'gray'}>
                          {c.status ?? 'unknown'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data?.certifications ?? []).length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">No certifications recorded yet.</div>
              )}
            </div>
          )}

          {tab === 'Schedules' && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Weekly Schedule Slots ({data?.schedules.length ?? 0})</h3>
              <div className="grid grid-cols-7 gap-1 text-xs">
                {DAYS.map(d => (
                  <div key={d} className="text-center font-medium text-gray-500 py-1 bg-gray-50 rounded">{d}</div>
                ))}
                {DAYS.map((_, dayIdx) => {
                  const daySlots = (data?.schedules ?? []).filter(s => s.day_of_week === dayIdx + 1);
                  return (
                    <div key={dayIdx} className="min-h-16 rounded border border-gray-100 p-1 space-y-1">
                      {daySlots.map((slot, i) => (
                        <div key={i} className="bg-indigo-100 text-indigo-700 rounded px-1 py-0.5 text-xs">
                          {slot.start_time} – {slot.end_time}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              {(data?.schedules ?? []).length === 0 && (
                <p className="text-center text-gray-400 text-sm mt-4">No schedule slots configured yet.</p>
              )}
            </div>
          )}

          {tab === 'Performance' && (
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Teacher Performance Ratings</h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>{['Teacher', 'Avg Rating', 'Reviews', 'Sessions', 'Upcoming'].map(h =>
                      <th key={h} className="px-3 py-2 text-left">{h}</th>
                    )}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data?.teachers ?? [])
                      .filter(t => t.avg_rating !== null)
                      .sort((a, b) => Number(b.avg_rating) - Number(a.avg_rating))
                      .map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{t.first_name} {t.last_name}</td>
                          <td className="px-3 py-2 text-amber-600 font-semibold">★ {t.avg_rating}</td>
                          <td className="px-3 py-2 text-gray-500">{t.rating_count}</td>
                          <td className="px-3 py-2 text-gray-500">{t.total_sessions}</td>
                          <td className="px-3 py-2 text-gray-500">{t.upcoming_sessions}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {(data?.teachers ?? []).filter(t => t.avg_rating !== null).length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-8">No performance ratings yet.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
