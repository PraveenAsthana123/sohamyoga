'use client';

import { useEffect, useState, useCallback } from 'react';

interface Profile {
  businessName: string; serviceType: string; servicesDescription: string; pricingInfo: string; businessHours: string; holidaysClosures: string;
}
interface Contact { id: string; fullName: string; email: string | null; phone: string | null; status: string; source: string; createdAt: string }
interface CallRow { id: string; contactName: string | null; direction: string; status: string; durationSeconds: number | null; outcomeNotes: string | null; needsFollowUp: boolean; createdAt: string }
interface ScriptRow { id: string; name: string; direction: 'inbound' | 'outbound'; scenarioKey: string | null; status: string; opening: string; closing: string }

function CostCapWidget({ businessId }: { businessId: string }) {
  const [cap, setCap] = useState<number | null>(null);
  const [spent, setSpent] = useState(0);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/admin/business-customers/${businessId}/cost-cap`).then(r => r.json()).then(d => {
      setCap(d.monthlyCostCapUsd); setSpent(d.monthToDateSpendUsd ?? 0);
      setInput(d.monthlyCostCapUsd !== null ? String(d.monthlyCostCapUsd) : '');
    });
  }, [businessId]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/business-customers/${businessId}/cost-cap`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyCostCapUsd: input.trim() ? Number(input) : null }),
    });
    setSaving(false); load();
  }

  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-3 flex items-center gap-3 text-sm">
      <span className="opacity-70">Month-to-date Vapi spend: <strong>${spent.toFixed(2)}</strong></span>
      <span className="opacity-50">|</span>
      <label className="flex items-center gap-1">
        Monthly cap ($)
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="no cap" className="w-20 border border-black/20 dark:border-white/20 rounded px-2 py-0.5" />
      </label>
      <button onClick={save} disabled={saving} className="text-xs underline">{saving ? 'Saving…' : 'Save'}</button>
      {cap !== null && spent >= cap && <span className="text-red-600 text-xs font-medium">Cap reached</span>}
    </div>
  );
}

export default function BusinessDetailClient({ businessId }: { businessId: string }) {
  const [tab, setTab] = useState<'profile' | 'contacts' | 'scripts' | 'calls'>('profile');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newContact, setNewContact] = useState({ fullName: '', email: '', phone: '' });
  const [newScript, setNewScript] = useState({ name: '', direction: 'outbound' as 'inbound' | 'outbound', scenarioKey: '', opening: '', closing: '' });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/admin/business-customers/${businessId}`, { cache: 'no-store' }).then(r => r.json()).then(d => {
      setProfile(d.profile); setContacts(d.contacts ?? []); setCalls(d.calls ?? []);
    });
    fetch(`/api/admin/business-customers/${businessId}/scripts`, { cache: 'no-store' }).then(r => r.json()).then(d => setScripts(d.scripts ?? []));
  }, [businessId]);
  useEffect(() => { load(); }, [load]);

  async function saveProfile() {
    if (!profile) return;
    setSaving(true); setSaved(false);
    await fetch(`/api/admin/business-customers/${businessId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
    setSaving(false); setSaved(true);
  }

  async function addContact() {
    setError(null);
    const res = await fetch(`/api/admin/business-customers/${businessId}/contacts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: newContact.fullName, email: newContact.email || undefined, phone: newContact.phone || undefined }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error); return; }
    setNewContact({ fullName: '', email: '', phone: '' }); load();
  }

  async function addScript() {
    setError(null);
    const res = await fetch(`/api/admin/business-customers/${businessId}/scripts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newScript, scenarioKey: newScript.scenarioKey || undefined }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error); return; }
    setNewScript({ name: '', direction: 'outbound', scenarioKey: '', opening: '', closing: '' }); load();
  }

  if (!profile) return <p className="text-sm opacity-60">Loading…</p>;

  return (
    <div className="space-y-4">
      <CostCapWidget businessId={businessId} />
      <div className="flex gap-2 border-b border-black/10 dark:border-white/10">
        {(['profile', 'contacts', 'scripts', 'calls'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm capitalize ${tab === t ? 'border-b-2 border-black dark:border-white font-medium' : 'opacity-60'}`}>{t}</button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {tab === 'profile' && (
        <div className="space-y-3 max-w-lg">
          <div className="space-y-1"><label className="text-sm font-medium">Business name</label>
            <input value={profile.businessName} onChange={e => setProfile({ ...profile, businessName: e.target.value })} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" /></div>
          <div className="space-y-1"><label className="text-sm font-medium">Services offered</label>
            <textarea value={profile.servicesDescription} onChange={e => setProfile({ ...profile, servicesDescription: e.target.value })} rows={3} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" /></div>
          <div className="space-y-1"><label className="text-sm font-medium">Pricing</label>
            <textarea value={profile.pricingInfo} onChange={e => setProfile({ ...profile, pricingInfo: e.target.value })} rows={2} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium">Business hours</label>
              <input value={profile.businessHours} onChange={e => setProfile({ ...profile, businessHours: e.target.value })} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Holidays / closures</label>
              <input value={profile.holidaysClosures} onChange={e => setProfile({ ...profile, holidaysClosures: e.target.value })} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" /></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={saveProfile} disabled={saving} className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            {saved && <span className="text-sm text-green-600">Saved.</span>}
          </div>
        </div>
      )}

      {tab === 'contacts' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input placeholder="Full name" value={newContact.fullName} onChange={e => setNewContact({ ...newContact, fullName: e.target.value })} className="border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
            <input placeholder="Email" value={newContact.email} onChange={e => setNewContact({ ...newContact, email: e.target.value })} className="border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
            <input placeholder="Phone" value={newContact.phone} onChange={e => setNewContact({ ...newContact, phone: e.target.value })} className="border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
            <button onClick={addContact} disabled={!newContact.fullName || (!newContact.email && !newContact.phone)} className="rounded bg-black text-white dark:bg-white dark:text-black px-3 py-1 text-sm disabled:opacity-50">Add</button>
          </div>
          <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/10 text-left"><tr><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Phone</th><th className="p-2">Source</th></tr></thead>
              <tbody>
                {contacts.map(c => <tr key={c.id} className="border-t border-black/10 dark:border-white/10"><td className="p-2">{c.fullName}</td><td className="p-2">{c.email ?? '—'}</td><td className="p-2">{c.phone ?? '—'}</td><td className="p-2 opacity-60">{c.source}</td></tr>)}
                {!contacts.length && <tr><td colSpan={4} className="p-4 text-center opacity-50">No contacts yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'scripts' && (
        <div className="space-y-3">
          <div className="border border-black/10 dark:border-white/10 rounded-lg p-3 space-y-2 max-w-lg">
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Script name" value={newScript.name} onChange={e => setNewScript({ ...newScript, name: e.target.value })} className="border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
              <select value={newScript.direction} onChange={e => setNewScript({ ...newScript, direction: e.target.value as 'inbound' | 'outbound' })} className="border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm">
                <option value="inbound">Inbound</option><option value="outbound">Outbound</option>
              </select>
            </div>
            <input placeholder="Scenario key" value={newScript.scenarioKey} onChange={e => setNewScript({ ...newScript, scenarioKey: e.target.value })} className="w-full border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
            <textarea placeholder="Opening" value={newScript.opening} onChange={e => setNewScript({ ...newScript, opening: e.target.value })} rows={2} className="w-full border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
            <textarea placeholder="Closing" value={newScript.closing} onChange={e => setNewScript({ ...newScript, closing: e.target.value })} rows={2} className="w-full border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
            <button onClick={addScript} disabled={!newScript.name || !newScript.opening || !newScript.closing} className="rounded bg-black text-white dark:bg-white dark:text-black px-3 py-1 text-sm disabled:opacity-50">Create</button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {(['inbound', 'outbound'] as const).map(dir => (
              <div key={dir} className="space-y-2">
                <h3 className="text-sm font-medium opacity-70 capitalize">{dir} ({scripts.filter(s => s.direction === dir).length})</h3>
                {scripts.filter(s => s.direction === dir).map(s => (
                  <div key={s.id} className="border border-black/10 dark:border-white/10 rounded p-2 text-sm">
                    <p className="font-medium">{s.name}</p>
                    <p className="opacity-60 text-xs">{s.opening}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'calls' && (
        <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-black/5 dark:bg-white/10 text-left"><tr><th className="p-2">Contact</th><th className="p-2">Direction</th><th className="p-2">Status</th><th className="p-2">Duration</th><th className="p-2">Notes</th><th className="p-2">Follow-up?</th></tr></thead>
            <tbody>
              {calls.map(c => (
                <tr key={c.id} className="border-t border-black/10 dark:border-white/10">
                  <td className="p-2">{c.contactName ?? '—'}</td><td className="p-2 capitalize">{c.direction}</td><td className="p-2 capitalize">{c.status}</td>
                  <td className="p-2">{c.durationSeconds != null ? `${c.durationSeconds}s` : '—'}</td>
                  <td className="p-2 max-w-xs truncate" title={c.outcomeNotes ?? ''}>{c.outcomeNotes ?? '—'}</td>
                  <td className="p-2">{c.needsFollowUp ? <span className="text-amber-600 font-medium">Yes</span> : 'No'}</td>
                </tr>
              ))}
              {!calls.length && <tr><td colSpan={6} className="p-4 text-center opacity-50">No calls logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
