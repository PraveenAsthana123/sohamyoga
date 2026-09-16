'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['All Contacts', 'By Type', 'Add Contact', 'Activity Log', 'Import/Export'] as const;
type Tab = typeof TABS[number];

interface ContactRow {
  id: number;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  contact_type: string;
  status: string;
  source: string | null;
  tags: string[] | null;
  notes: string | null;
  last_contacted_at: string | null;
  assigned_to: string | null;
  linkedin_url: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
}

const badge = (color: string, label: string) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${color}-500/20 text-${color}-300`}>{label}</span>
);

const typeColor: Record<string, string> = {
  lead: 'blue', customer: 'green', vendor: 'purple', partner: 'teal', prospect: 'yellow',
};

function fullName(c: ContactRow) { return [c.first_name, c.last_name].filter(Boolean).join(' '); }
function formatDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ContactManagementPage() {
  const [tab, setTab] = useState<Tab>('All Contacts');
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editLastContacted, setEditLastContacted] = useState('');

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', company: '',
    job_title: '', contact_type: 'lead', source: '', tags: '', notes: '',
    assigned_to: '', linkedin_url: '', website: '', country: '', city: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/contacts', { cache: 'no-store' });
      const data = await res.json() as { contacts: ContactRow[] };
      setContacts(data.contacts ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchContacts(); }, [fetchContacts]);

  const filtered = contacts.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return fullName(c).toLowerCase().includes(q)
      || (c.email ?? '').toLowerCase().includes(q)
      || (c.company ?? '').toLowerCase().includes(q);
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg('');
    try {
      const body = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      };
      const res = await fetch('/api/admin/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        setMsg('Contact created.');
        setForm({ first_name: '', last_name: '', email: '', phone: '', company: '', job_title: '', contact_type: 'lead', source: '', tags: '', notes: '', assigned_to: '', linkedin_url: '', website: '', country: '', city: '' });
        void fetchContacts();
      } else {
        const d = await res.json() as { error: string };
        setMsg(`Error: ${d.error}`);
      }
    } catch { setMsg('Network error.'); }
    setSaving(false);
  }

  async function saveEdit(id: number) {
    await fetch('/api/admin/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, notes: editNotes, last_contacted_at: editLastContacted || undefined }),
    });
    setEditId(null);
    void fetchContacts();
  }

  async function archiveContact(id: number) {
    await fetch(`/api/admin/contacts?id=${id}`, { method: 'DELETE' });
    void fetchContacts();
  }

  function exportCsv() {
    const headers = ['id', 'first_name', 'last_name', 'email', 'phone', 'company', 'job_title', 'contact_type', 'source', 'country', 'city', 'created_at'];
    const rows = contacts.map(c =>
      headers.map(h => {
        const v = c[h as keyof ContactRow];
        const s = v === null || v === undefined ? '' : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'contacts.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // By type: counts and most recent
  const typeSummary = (['lead', 'customer', 'vendor', 'partner', 'prospect'] as const).map(t => {
    const group = contacts.filter(c => c.contact_type === t);
    const latest = group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    return { type: t, count: group.length, latest: latest?.created_at ?? null };
  });

  // Activity log: contacts with last_contacted_at grouped by date
  const withActivity = contacts.filter(c => c.last_contacted_at);
  const byDate: Record<string, ContactRow[]> = {};
  for (const c of withActivity) {
    const date = new Date(c.last_contacted_at!).toISOString().slice(0, 10);
    (byDate[date] ??= []).push(c);
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  const glassCard = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl';
  const inputClass = 'w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-indigo-400';
  const labelClass = 'block text-white/70 text-sm mb-1';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Contact Management</h1>
          <p className="text-white/60 mt-1">Leads, customers, vendors, partners, and prospects in one place</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* All Contacts */}
        {tab === 'All Contacts' && (
          <div className={glassCard}>
            <div className="mb-4">
              <input
                className={inputClass + ' max-w-sm'}
                placeholder="Search by name, email, company…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {loading ? <p className="text-white/50">Loading…</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-white/80">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50 text-xs uppercase">
                      <th className="text-left py-2 pr-3">Name</th>
                      <th className="text-left py-2 pr-3">Email</th>
                      <th className="text-left py-2 pr-3">Company</th>
                      <th className="text-left py-2 pr-3">Type</th>
                      <th className="text-left py-2 pr-3">Source</th>
                      <th className="text-left py-2 pr-3">Last Contacted</th>
                      <th className="text-left py-2 pr-3">Status</th>
                      <th className="text-left py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-white/40">No contacts found.</td></tr>}
                    {filtered.map(c => (
                      <>
                        <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2 pr-3 font-medium text-white">{fullName(c)}</td>
                          <td className="py-2 pr-3 text-white/70">{c.email ?? '—'}</td>
                          <td className="py-2 pr-3 text-white/60">{c.company ?? '—'}</td>
                          <td className="py-2 pr-3">{badge(typeColor[c.contact_type] ?? 'gray', c.contact_type)}</td>
                          <td className="py-2 pr-3 text-white/60">{c.source ?? '—'}</td>
                          <td className="py-2 pr-3 text-white/60 text-xs">{formatDate(c.last_contacted_at)}</td>
                          <td className="py-2 pr-3">{badge(c.status === 'active' ? 'green' : 'red', c.status)}</td>
                          <td className="py-2">
                            <div className="flex gap-1">
                              <button onClick={() => { setEditId(c.id); setEditNotes(c.notes ?? ''); setEditLastContacted(c.last_contacted_at?.slice(0, 10) ?? ''); }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs">Edit</button>
                              <button onClick={() => void archiveContact(c.id)}
                                className="bg-red-600/80 hover:bg-red-700 text-white px-3 py-1 rounded text-xs">Del</button>
                            </div>
                          </td>
                        </tr>
                        {editId === c.id && (
                          <tr key={`edit-${c.id}`} className="bg-white/5">
                            <td colSpan={8} className="px-4 py-3">
                              <div className="flex flex-wrap gap-3 items-end">
                                <div>
                                  <label className={labelClass}>Notes</label>
                                  <textarea rows={2} className={inputClass + ' w-64'} value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                                </div>
                                <div>
                                  <label className={labelClass}>Last Contacted</label>
                                  <input type="date" className={inputClass + ' w-44'} value={editLastContacted} onChange={e => setEditLastContacted(e.target.value)} />
                                </div>
                                <button onClick={() => void saveEdit(c.id)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-xs">Save</button>
                                <button onClick={() => setEditId(null)} className="bg-white/10 text-white/60 px-3 py-2 rounded text-xs">Cancel</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* By Type */}
        {tab === 'By Type' && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {typeSummary.map(t => (
              <div key={t.type} className={glassCard + ' text-center'}>
                <div className="text-4xl font-bold text-white">{t.count}</div>
                <div className="mt-2">{badge(typeColor[t.type] ?? 'gray', t.type.charAt(0).toUpperCase() + t.type.slice(1) + 's')}</div>
                <div className="text-white/40 text-xs mt-2">Latest: {formatDate(t.latest)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Add Contact */}
        {tab === 'Add Contact' && (
          <div className={glassCard}>
            <h2 className="text-white font-semibold text-lg mb-4">New Contact</h2>
            <form onSubmit={e => void handleAdd(e)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>First Name *</label>
                <input className={inputClass} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Jane" required />
              </div>
              <div>
                <label className={labelClass}>Last Name</label>
                <input className={inputClass} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Smith" />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" className={inputClass} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input className={inputClass} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 555 000 0000" />
              </div>
              <div>
                <label className={labelClass}>Company</label>
                <input className={inputClass} value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Acme Corp" />
              </div>
              <div>
                <label className={labelClass}>Job Title</label>
                <input className={inputClass} value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} placeholder="Head of Marketing" />
              </div>
              <div>
                <label className={labelClass}>Contact Type</label>
                <select className={inputClass} value={form.contact_type} onChange={e => setForm(f => ({ ...f, contact_type: e.target.value }))}>
                  {['lead', 'customer', 'vendor', 'partner', 'prospect'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Source</label>
                <select className={inputClass} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  <option value="">— Select —</option>
                  {['website', 'referral', 'linkedin', 'event', 'cold-outreach'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Assigned To</label>
                <input className={inputClass} value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="Sales rep name" />
              </div>
              <div>
                <label className={labelClass}>LinkedIn URL</label>
                <input className={inputClass} value={form.linkedin_url} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/…" />
              </div>
              <div>
                <label className={labelClass}>Country</label>
                <input className={inputClass} value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="Canada" />
              </div>
              <div>
                <label className={labelClass}>City</label>
                <input className={inputClass} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Toronto" />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Notes</label>
                <textarea rows={2} className={inputClass} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any relevant notes…" />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Tags (comma-separated)</label>
                <input className={inputClass} value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="vip, warm, q4" />
              </div>
              <div className="md:col-span-2 flex items-center gap-4">
                <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:opacity-50">
                  {saving ? 'Saving…' : 'Add Contact'}
                </button>
                {msg && <span className={`text-sm ${msg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{msg}</span>}
              </div>
            </form>
          </div>
        )}

        {/* Activity Log */}
        {tab === 'Activity Log' && (
          <div className={glassCard}>
            <h2 className="text-white font-semibold text-lg mb-4">Activity Log</h2>
            {sortedDates.length === 0 ? (
              <p className="text-white/40">No contact activity recorded. Update &quot;Last Contacted&quot; on contacts to populate this log.</p>
            ) : (
              <div className="space-y-6">
                {sortedDates.map(date => (
                  <div key={date}>
                    <h3 className="text-white/50 text-xs uppercase font-semibold mb-2">{formatDate(date)}</h3>
                    <div className="space-y-2">
                      {byDate[date].map(c => (
                        <div key={c.id} className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-2">
                          <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                          <div className="flex-1">
                            <span className="text-white text-sm font-medium">{fullName(c)}</span>
                            {c.company && <span className="text-white/50 text-xs ml-2">@ {c.company}</span>}
                          </div>
                          {badge(typeColor[c.contact_type] ?? 'gray', c.contact_type)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Import/Export */}
        {tab === 'Import/Export' && (
          <div className={glassCard}>
            <h2 className="text-white font-semibold text-lg mb-6">Import / Export</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h3 className="text-white font-medium mb-2">Export Contacts</h3>
                <p className="text-white/60 text-sm mb-4">Download all contacts ({contacts.length}) as a CSV file.</p>
                <button onClick={exportCsv} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm">
                  Download CSV
                </button>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h3 className="text-white font-medium mb-2">Import Contacts</h3>
                <p className="text-white/60 text-sm mb-4">Upload a CSV file to import contacts.</p>
                <input
                  type="file"
                  accept=".csv"
                  className="block text-white/60 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-white/20 file:text-white hover:file:bg-white/30 cursor-pointer"
                  onChange={e => {
                    // TODO: implement real CSV parsing and bulk contact creation
                    console.log('File selected for import:', e.target.files?.[0]?.name);
                  }}
                />
                <p className="text-white/30 text-xs mt-2">CSV import not yet implemented — file selection is logged to console.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
