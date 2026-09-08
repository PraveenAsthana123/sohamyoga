'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { buildSystemPrompt, estimateTokens, RECOMMENDED_MAX_PROMPT_TOKENS } from '@/domain/script/promptBuilder';
import NotificationBell from '@/components/NotificationBell';

interface Profile {
  businessName: string; serviceType: string; servicesDescription: string; pricingInfo: string;
  businessHours: string; holidaysClosures: string;
  welcomeNote: string; thankYouNote: string; paymentNote: string;
}
interface Contact { id: string; fullName: string; email: string | null; phone: string | null; status: string; source: string; createdAt: string }
interface CallRow { id: string; contactName: string | null; direction: string; status: string; durationSeconds: number | null; outcomeNotes: string | null; needsFollowUp: boolean; createdAt: string }
interface ScriptRow { id: string; name: string; direction: 'inbound' | 'outbound'; scenarioKey: string | null; status: string; opening: string; discoveryQuestions: string[]; objectionHandling: string; closing: string }

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

function ProfileTab() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetchJson<Profile>('/api/customer/profile').then(setProfile); }, []);

  async function save() {
    if (!profile) return;
    setSaving(true); setSaved(false);
    await fetch('/api/customer/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
    setSaving(false); setSaved(true);
  }

  if (!profile) return <p className="text-sm opacity-60">Loading…</p>;
  return (
    <div className="space-y-3 max-w-lg">
      <div className="space-y-1">
        <label className="text-sm font-medium">Business name</label>
        <input value={profile.businessName} onChange={(e) => setProfile({ ...profile, businessName: e.target.value })} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Services offered</label>
        <textarea value={profile.servicesDescription} onChange={(e) => setProfile({ ...profile, servicesDescription: e.target.value })} rows={3} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Pricing</label>
        <textarea value={profile.pricingInfo} onChange={(e) => setProfile({ ...profile, pricingInfo: e.target.value })} rows={2} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Business hours</label>
          <input value={profile.businessHours} onChange={(e) => setProfile({ ...profile, businessHours: e.target.value })} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Holidays / closures</label>
          <input value={profile.holidaysClosures} onChange={(e) => setProfile({ ...profile, holidaysClosures: e.target.value })} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Welcome note</label>
        <textarea placeholder="How should the AI greet a new caller?" value={profile.welcomeNote} onChange={(e) => setProfile({ ...profile, welcomeNote: e.target.value })} rows={2} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Thank-you note</label>
        <textarea placeholder="How should the AI sign off?" value={profile.thankYouNote} onChange={(e) => setProfile({ ...profile, thankYouNote: e.target.value })} rows={2} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">Payment note</label>
        <textarea placeholder="How should the AI describe payment/booking?" value={profile.paymentNote} onChange={(e) => setProfile({ ...profile, paymentNote: e.target.value })} rows={2} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className="rounded bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        {saved && <span className="text-sm text-green-600">Saved.</span>}
      </div>
      <p className="text-xs opacity-50">
        This content is auto-included as real business context in your Vapi assistant&apos;s system prompt at sync time
        — you don&apos;t need to retype it into every script. Vapi technical settings (voice, model) are managed by our team, not from here.
      </p>
    </div>
  );
}

function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: { row: number; reason: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchJson<{ contacts: Contact[] }>('/api/customer/contacts').then((d) => { setContacts(d?.contacts ?? []); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addContact() {
    setError(null);
    const res = await fetch('/api/customer/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName, email: email || undefined, phone: phone || undefined }) });
    const body = await res.json();
    if (!res.ok) { setError(body.error); return; }
    setFullName(''); setEmail(''); setPhone(''); load();
  }

  async function uploadCsv() {
    if (!csvFile) return;
    setError(null); setImportResult(null);
    const form = new FormData();
    form.append('file', csvFile);
    const res = await fetch('/api/customer/contacts/import', { method: 'POST', body: form });
    const body = await res.json();
    if (!res.ok) { setError(body.error); return; }
    setImportResult(body);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 space-y-2">
        <h2 className="font-medium text-sm">Add a contact</h2>
        <div className="flex flex-wrap gap-2">
          <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
          <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
          <button onClick={addContact} disabled={!fullName || (!email && !phone)} className="rounded bg-black text-white dark:bg-white dark:text-black px-3 py-1 text-sm disabled:opacity-50">Add</button>
        </div>
      </div>
      <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 space-y-2">
        <h2 className="font-medium text-sm">Bulk upload (CSV — name, email, phone columns)</h2>
        <div className="flex items-center gap-2">
          <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)} className="text-sm" />
          <button onClick={uploadCsv} disabled={!csvFile} className="rounded bg-black text-white dark:bg-white dark:text-black px-3 py-1 text-sm disabled:opacity-50">Upload</button>
        </div>
        {importResult && (
          <p className="text-xs opacity-70">Imported {importResult.imported}. {importResult.skipped.length > 0 && `Skipped ${importResult.skipped.length}: ${importResult.skipped.map((s) => `row ${s.row} (${s.reason})`).join(', ')}`}</p>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <p className="text-sm opacity-60">Loading…</p> : (
        <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-black/5 dark:bg-white/10 text-left"><tr><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Phone</th><th className="p-2">Source</th></tr></thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-t border-black/10 dark:border-white/10">
                  <td className="p-2">{c.fullName}</td><td className="p-2">{c.email ?? '—'}</td><td className="p-2">{c.phone ?? '—'}</td><td className="p-2 opacity-60">{c.source}</td>
                </tr>
              ))}
              {!contacts.length && <tr><td colSpan={4} className="p-4 text-center opacity-50">No contacts yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CallsTab() {
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchJson<{ calls: CallRow[] }>('/api/customer/calls').then((d) => { setCalls(d?.calls ?? []); setLoading(false); }); }, []);

  if (loading) return <p className="text-sm opacity-60">Loading…</p>;
  return (
    <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-black/5 dark:bg-white/10 text-left"><tr><th className="p-2">Contact</th><th className="p-2">Direction</th><th className="p-2">Status</th><th className="p-2">Duration</th><th className="p-2">Notes</th><th className="p-2">Follow-up?</th></tr></thead>
        <tbody>
          {calls.map((c) => (
            <tr key={c.id} className="border-t border-black/10 dark:border-white/10">
              <td className="p-2">{c.contactName ?? '—'}</td>
              <td className="p-2 capitalize">{c.direction}</td>
              <td className="p-2 capitalize">{c.status}</td>
              <td className="p-2">{c.durationSeconds != null ? `${c.durationSeconds}s` : '—'}</td>
              <td className="p-2 max-w-xs truncate" title={c.outcomeNotes ?? ''}>{c.outcomeNotes ?? '—'}</td>
              <td className="p-2">{c.needsFollowUp ? <span className="text-amber-600 font-medium">Yes</span> : 'No'}</td>
            </tr>
          ))}
          {!calls.length && <tr><td colSpan={6} className="p-4 text-center opacity-50">No calls logged yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ScriptsTab() {
  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''); const [direction, setDirection] = useState<'inbound' | 'outbound'>('outbound');
  const [scenarioKey, setScenarioKey] = useState(''); const [opening, setOpening] = useState('');
  const [discoveryQuestions, setDiscoveryQuestions] = useState(''); const [objectionHandling, setObjectionHandling] = useState('');
  const [closing, setClosing] = useState(''); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);

  const estimatedTokens = useMemo(() => estimateTokens(buildSystemPrompt({
    opening, discoveryQuestions: discoveryQuestions.split('\n').map((q) => q.trim()).filter(Boolean), objectionHandling, closing,
  })), [opening, discoveryQuestions, objectionHandling, closing]);

  const load = useCallback(() => {
    setLoading(true);
    fetchJson<{ scripts: ScriptRow[] }>('/api/customer/scripts').then((d) => { setScripts(d?.scripts ?? []); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setError(null); setSaving(true);
    const res = await fetch('/api/customer/scripts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, direction, scenarioKey: scenarioKey || undefined, opening, closing, objectionHandling, discoveryQuestions: discoveryQuestions.split('\n').map((q) => q.trim()).filter(Boolean) }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) { setError(body.error); return; }
    setName(''); setScenarioKey(''); setOpening(''); setDiscoveryQuestions(''); setObjectionHandling(''); setClosing(''); setOpen(false);
    load();
  }

  const inbound = scripts.filter((s) => s.direction === 'inbound');
  const outbound = scripts.filter((s) => s.direction === 'outbound');

  function renderGroup(label: string, group: ScriptRow[]) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium opacity-70">{label} ({group.length})</h3>
        {group.map((s) => (
          <div key={s.id} className="border border-black/10 dark:border-white/10 rounded-lg p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">{s.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full border border-black/20 dark:border-white/20 capitalize">{s.status}</span>
            </div>
            {s.scenarioKey && <p className="text-xs opacity-50 capitalize">{s.scenarioKey.replace(/_/g, ' ')}</p>}
            <p><span className="opacity-60">Opening:</span> {s.opening}</p>
            {s.closing && <p><span className="opacity-60">Closing:</span> {s.closing}</p>}
          </div>
        ))}
        {!group.length && <p className="text-xs opacity-40">No {label.toLowerCase()} scripts yet.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs opacity-50">Script content only — voice, model, and technical settings are managed by our team.</p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="rounded bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 text-sm">+ New script</button>
      ) : (
        <div className="border border-black/10 dark:border-white/10 rounded-lg p-4 space-y-2 max-w-lg">
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Script name" value={name} onChange={(e) => setName(e.target.value)} className="border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
            <select value={direction} onChange={(e) => setDirection(e.target.value as 'inbound' | 'outbound')} className="border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm">
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
          </div>
          <input placeholder="Scenario key (e.g. appointment_reminder)" value={scenarioKey} onChange={(e) => setScenarioKey(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
          <textarea placeholder="Opening line" value={opening} onChange={(e) => setOpening(e.target.value)} rows={2} className="w-full border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
          <textarea placeholder="Discovery questions (one per line)" value={discoveryQuestions} onChange={(e) => setDiscoveryQuestions(e.target.value)} rows={3} className="w-full border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
          <textarea placeholder="Objection handling" value={objectionHandling} onChange={(e) => setObjectionHandling(e.target.value)} rows={2} className="w-full border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
          <textarea placeholder="Closing line" value={closing} onChange={(e) => setClosing(e.target.value)} rows={2} className="w-full border border-black/20 dark:border-white/20 rounded px-2 py-1 text-sm" />
          <p className={`text-xs ${estimatedTokens > RECOMMENDED_MAX_PROMPT_TOKENS ? 'text-amber-600' : 'opacity-50'}`}>
            ~{estimatedTokens} tokens{estimatedTokens > RECOMMENDED_MAX_PROMPT_TOKENS ? ' -- consider shortening to keep calls cost-efficient.' : ''}
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={create} disabled={saving || !name || !opening || !closing} className="rounded bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Create'}</button>
            <button onClick={() => setOpen(false)} className="text-sm opacity-60">Cancel</button>
          </div>
        </div>
      )}
      {loading ? <p className="text-sm opacity-60">Loading…</p> : (
        <div className="grid md:grid-cols-2 gap-6">
          {renderGroup('Inbound', inbound)}
          {renderGroup('Outbound', outbound)}
        </div>
      )}
    </div>
  );
}

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'profile' | 'contacts' | 'scripts' | 'calls'>('profile');

  async function logout() {
    await fetch('/api/customer/auth/logout', { method: 'POST' });
    router.push('/customer/login');
    router.refresh();
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Business Portal</h1>
        <div className="flex items-center gap-3">
          <NotificationBell basePath="/api/customer/notifications" />
          <button onClick={logout} className="text-sm underline opacity-70">Log out</button>
        </div>
      </div>
      <div className="flex gap-2 border-b border-black/10 dark:border-white/10">
        {(['profile', 'contacts', 'scripts', 'calls'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm capitalize ${tab === t ? 'border-b-2 border-black dark:border-white font-medium' : 'opacity-60'}`}>{t}</button>
        ))}
      </div>
      {tab === 'profile' && <ProfileTab />}
      {tab === 'contacts' && <ContactsTab />}
      {tab === 'scripts' && <ScriptsTab />}
      {tab === 'calls' && <CallsTab />}
    </div>
  );
}
