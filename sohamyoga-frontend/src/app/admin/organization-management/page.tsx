'use client';

import { useEffect, useState, useCallback } from 'react';

interface Organization {
  id: number;
  name: string;
  slug: string | null;
  type: string;
  plan: string;
  status: string;
  domain: string | null;
  industry: string | null;
  employee_count: string | null;
  billing_email: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  settings: Record<string, unknown>;
  created_at: string;
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-500/30 text-gray-200',
  starter: 'bg-blue-500/30 text-blue-200',
  professional: 'bg-purple-500/30 text-purple-200',
  enterprise: 'bg-amber-500/30 text-amber-200',
};
const TYPE_COLORS: Record<string, string> = {
  client: 'bg-green-500/30 text-green-200',
  partner: 'bg-blue-500/30 text-blue-200',
  vendor: 'bg-orange-500/30 text-orange-200',
  internal: 'bg-pink-500/30 text-pink-200',
};

const glass = 'bg-slate-800/70 border border-white/20 rounded-2xl p-6 shadow-xl';
const tabBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
const tabActive = 'bg-white/20 text-white';
const tabInactive = 'text-white/60 hover:bg-white/10';

type Tab = 'all' | 'add' | 'plans' | 'settings';

export default function OrganizationManagementPage() {
  const [tab, setTab] = useState<Tab>('all');
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [form, setForm] = useState({
    name: '', slug: '', type: 'client', plan: 'free', status: 'active',
    domain: '', industry: '', employee_count: '', billing_email: '',
    contact_name: '', contact_phone: '',
  });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/organizations');
      const data = await res.json() as { organizations: Organization[] };
      setOrgs(data.organizations || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) { showToast('Organization created'); setTab('all'); load(); }
    else { showToast('Error creating organization'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this organization?')) return;
    await fetch(`/api/admin/organizations?id=${id}`, { method: 'DELETE' });
    showToast('Deleted'); load();
  };

  const planGroups = orgs.reduce<Record<string, Organization[]>>((acc, o) => {
    acc[o.plan] = [...(acc[o.plan] || []), o];
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl bg-white/20 px-4 py-2 text-white  shadow-xl">
          {toast}
        </div>
      )}
      <h1 className="mb-6 text-3xl font-bold text-white">Organization Management 🏢</h1>

      <div className="mb-6 flex gap-2 flex-wrap">
        {(['all','add','plans','settings'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`${tabBase} ${tab === t ? tabActive : tabInactive}`}>
            {t === 'all' ? 'All Organizations' : t === 'add' ? 'Add Organization' : t === 'plans' ? 'Plans & Billing' : 'Settings'}
          </button>
        ))}
      </div>

      {tab === 'all' && (
        <div className={glass}>
          <h2 className="mb-4 text-xl font-semibold text-white">All Organizations ({orgs.length})</h2>
          {loading ? <p className="text-white/60">Loading…</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-white/80">
                <thead><tr className="border-b border-white/20 text-white/60">
                  <th className="pb-2 text-left">Name</th>
                  <th className="pb-2 text-left">Type</th>
                  <th className="pb-2 text-left">Plan</th>
                  <th className="pb-2 text-left">Status</th>
                  <th className="pb-2 text-left">Domain</th>
                  <th className="pb-2 text-left">Contact</th>
                  <th className="pb-2 text-left">Actions</th>
                </tr></thead>
                <tbody>
                  {orgs.map((o) => (
                    <tr key={o.id} className="border-b border-white/10">
                      <td className="py-2 font-medium text-white">{o.name}</td>
                      <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${TYPE_COLORS[o.type] || 'bg-white/20 text-white'}`}>{o.type}</span></td>
                      <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PLAN_COLORS[o.plan] || 'bg-white/20 text-white'}`}>{o.plan}</span></td>
                      <td className="py-2">{o.status}</td>
                      <td className="py-2">{o.domain || '—'}</td>
                      <td className="py-2">{o.contact_name || '—'}</td>
                      <td className="py-2 flex gap-2">
                        <button onClick={() => { setSelectedOrg(o); setTab('settings'); }} className="text-xs text-blue-300 hover:text-blue-100">Settings</button>
                        <button onClick={() => handleDelete(o.id)} className="text-xs text-red-300 hover:text-red-100">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!orgs.length && <p className="py-8 text-center text-white/40">No organizations yet</p>}
            </div>
          )}
        </div>
      )}

      {tab === 'add' && (
        <div className={glass}>
          <h2 className="mb-4 text-xl font-semibold text-white">Add Organization</h2>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Name *', key: 'name', required: true },
              { label: 'Slug', key: 'slug' },
              { label: 'Domain', key: 'domain' },
              { label: 'Industry', key: 'industry' },
              { label: 'Employee Count', key: 'employee_count' },
              { label: 'Billing Email', key: 'billing_email' },
              { label: 'Contact Name', key: 'contact_name' },
              { label: 'Contact Phone', key: 'contact_phone' },
            ].map(({ label, key, required }) => (
              <div key={key}>
                <label className="mb-1 block text-sm text-white/70">{label}</label>
                <input
                  required={required}
                  value={(form as Record<string, string>)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-sm text-white/70">Type</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white focus:outline-none">
                {['client','partner','vendor','internal'].map((t) => <option key={t} value={t} className="bg-slate-800">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-white/70">Plan</label>
              <select value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white focus:outline-none">
                {['free','starter','professional','enterprise'].map((p) => <option key={p} value={p} className="bg-slate-800">{p}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="rounded-xl bg-purple-600 px-6 py-2 text-white font-semibold hover:bg-purple-500">Create Organization</button>
            </div>
          </form>
        </div>
      )}

      {tab === 'plans' && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Plans & Billing</h2>
          {['enterprise','professional','starter','free'].map((plan) => (
            <div key={plan} className={glass}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white capitalize">{plan}</h3>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${PLAN_COLORS[plan]}`}>
                  {planGroups[plan]?.length || 0} orgs
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(planGroups[plan] || []).map((o) => (
                  <div key={o.id} className="rounded-xl bg-white/5 p-3 border border-white/10">
                    <p className="font-medium text-white">{o.name}</p>
                    <p className="text-xs text-white/50">{o.billing_email || 'No billing email'}</p>
                    <p className="text-xs text-white/50">{o.industry || 'No industry'}</p>
                  </div>
                ))}
                {!(planGroups[plan]?.length) && <p className="text-white/40 text-sm">No organizations on this plan</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'settings' && (
        <div className={glass}>
          <h2 className="mb-4 text-xl font-semibold text-white">Organization Settings</h2>
          {selectedOrg ? (
            <div>
              <p className="text-white/70 mb-2">Settings for: <span className="text-white font-semibold">{selectedOrg.name}</span></p>
              <pre className="rounded-xl bg-black/30 p-4 text-sm text-green-300 overflow-auto max-h-64">
                {JSON.stringify(selectedOrg.settings, null, 2)}
              </pre>
              <button onClick={() => setSelectedOrg(null)} className="mt-3 text-sm text-white/60 hover:text-white">← Back</button>
            </div>
          ) : (
            <div className="space-y-2">
              {orgs.map((o) => (
                <button key={o.id} onClick={() => setSelectedOrg(o)}
                  className="w-full text-left rounded-xl bg-white/5 border border-white/10 p-3 hover:bg-white/10 transition-colors">
                  <span className="font-medium text-white">{o.name}</span>
                  <span className="ml-2 text-white/50 text-sm">({o.plan})</span>
                </button>
              ))}
              {!orgs.length && <p className="text-white/40">No organizations</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
