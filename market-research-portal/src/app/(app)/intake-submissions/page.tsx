'use client';

// Admin view of /intake submissions. The one non-obvious action here is
// "Convert to B2B" — it mutates the existing b2c row in place (segment flips,
// converted_from_b2c_at is stamped) rather than creating a duplicate row, so
// a single contact's history stays on one record across the transition.

import { useEffect, useState, useCallback } from 'react';

interface Submission {
  id: string; segment: string; contact_name: string; email: string; phone: string | null;
  company_name: string | null; role: string | null; use_case: string; status: string;
  converted_from_b2c_at: string | null; created_at: string;
}

export default function IntakeSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filter, setFilter] = useState<'all' | 'b2c' | 'b2b'>('all');
  const [converting, setConverting] = useState<Submission | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => fetch('/api/intake', { cache: 'no-store' }).then(r => r.json()).then(d => setSubmissions(d.submissions ?? [])), []);
  useEffect(() => { void load() }, [load]);

  const filtered = filter === 'all' ? submissions : submissions.filter(s => s.segment === filter);

  async function setStatus(submissionId: string, action: string) {
    await fetch('/api/intake', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId, action }) });
    await load();
  }

  async function convert(e: React.FormEvent) {
    e.preventDefault();
    if (!converting) return;
    const r = await fetch('/api/intake', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: converting.id, action: 'convert_to_b2b', companyName, role: role || undefined }),
    });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? 'Converted to B2B.' : j.error || 'Conversion failed.');
    if (r.ok) { setConverting(null); setCompanyName(''); setRole(''); }
    await load();
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold">Intake Submissions</h1>
        <p className="text-sm text-gray-500">B2C and B2B leads from the public intake form at /intake. A B2C submission can be converted to B2B without a duplicate record.</p>
      </div>

      <div className="flex gap-2">
        {(['all', 'b2c', 'b2b'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded px-3 py-1.5 text-sm ${filter === f ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{f.toUpperCase()}</button>
        ))}
      </div>
      {msg && <p className="text-sm text-gray-500">{msg}</p>}

      <div className="space-y-2">
        {filtered.map(s => (
          <div key={s.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${s.segment === 'b2b' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>{s.segment.toUpperCase()}</span>
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{s.status}</span>
                {s.converted_from_b2c_at && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">converted from B2C</span>}
                <h3 className="mt-1 font-semibold">{s.contact_name}{s.company_name ? ` · ${s.company_name}` : ''}</h3>
                <p className="text-xs text-gray-500">{s.email}{s.phone ? ` · ${s.phone}` : ''}{s.role ? ` · ${s.role}` : ''}</p>
                {s.use_case && <p className="mt-1 text-sm text-gray-600">{s.use_case}</p>}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                {s.segment === 'b2c' && s.status !== 'converted' && (
                  <button onClick={() => { setConverting(s); setCompanyName(''); setRole(''); setMsg(''); }} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">Convert to B2B</button>
                )}
                {s.status === 'new' && <button onClick={() => setStatus(s.id, 'contacted')} className="rounded bg-gray-500 px-2 py-1 text-xs text-white">Mark contacted</button>}
                {s.status !== 'lost' && <button onClick={() => setStatus(s.id, 'lost')} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">Mark lost</button>}
              </div>
            </div>
          </div>
        ))}
        {!filtered.length && <p className="text-sm text-gray-400">No submissions yet.</p>}
      </div>

      {converting && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 p-4">
          <form onSubmit={convert} className="w-full max-w-md space-y-3 rounded-xl bg-white p-5">
            <h3 className="font-semibold">Convert {converting.contact_name} to B2B</h3>
            <input required placeholder="Company name" className="w-full rounded border p-2 text-sm" value={companyName} onChange={e => setCompanyName(e.target.value)} />
            <input placeholder="Role (optional)" className="w-full rounded border p-2 text-sm" value={role} onChange={e => setRole(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConverting(null)} className="rounded px-3 py-1.5 text-sm text-gray-500">Cancel</button>
              <button type="submit" className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white">Convert</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
