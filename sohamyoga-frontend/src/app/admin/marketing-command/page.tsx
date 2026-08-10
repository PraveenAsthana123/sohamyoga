'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Model = { name: string; installed: boolean; enabled: boolean; isDefault: boolean; purpose: string };
type Channel = { channel: string; enabled: boolean; connection_status: string; provider: string };
type Campaign = { id: string; title: string; industry: string; status: string; progress_percent: number; current_stage: string; channels: string[]; asset_types: string[]; scheduled_at?: string; model_name?: string; asset_count: number };

const INDUSTRIES = ['yoga', 'dental', 'retail', 'restaurant', 'professional_services', 'other'];
const CHANNELS = ['facebook', 'instagram', 'linkedin', 'x_twitter', 'threads', 'tiktok', 'youtube', 'pinterest', 'reddit', 'bluesky', 'google_business', 'email', 'sms'];
const ASSETS = [
  ['copy', 'Social copy'], ['static_banner', 'Static banner'], ['dynamic_banner', 'Dynamic banner'],
  ['video_script', 'Video script'], ['video', 'Text-to-video'], ['thumbnail', 'YouTube thumbnail'],
];
const FLOW = [
  ['1', 'Customer brief', 'User selects business, goal, channels, assets, and schedule.'],
  ['2', 'Ollama generation', 'Local model writes channel copy, image prompts, and video script without cloud AI tokens.'],
  ['3', 'Service rendering', 'ComfyUI/banner renderer and video provider create media files.'],
  ['4', 'Admin approval', 'Human reviews brand, compliance, claims, and destination links.'],
  ['5', 'Scheduled publish', 'Postiz and YouTube publish only through connected developer accounts.'],
  ['6', 'Analytics', 'Delivery IDs, errors, clicks, and engagement are stored per tenant.'],
];

const initialProfile = { industry: 'yoga', businessName: '', audience: '', valueProposition: '', websiteUrl: '', timezone: 'America/Edmonton', approvalRequired: true };
const initialCampaign = { title: '', objective: 'awareness', audience: '', offerText: '', callToAction: '', scheduledAt: '', assetTypes: ['copy', 'static_banner'], channels: ['instagram', 'facebook'], modelName: '' };

export default function MarketingAutomationPage() {
  const [tenantId, setTenantId] = useState('');
  const [profile, setProfile] = useState(initialProfile);
  const [campaign, setCampaign] = useState(initialCampaign);
  const [models, setModels] = useState<Model[]>([]);
  const [channelRows, setChannelRows] = useState<Channel[]>([]);
  const [requests, setRequests] = useState<Campaign[]>([]);
  const [message, setMessage] = useState('Enter a tenant UUID to load persistent settings.');
  const [busy, setBusy] = useState(false);

  useEffect(() => setTenantId(localStorage.getItem('marketingTenantId') || ''), []);
  const configuredChannels = useMemo(() => Object.fromEntries(channelRows.map(c => [c.channel, c])), [channelRows]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setBusy(true);
    localStorage.setItem('marketingTenantId', tenantId);
    try {
      const [dashboardRes, modelsRes] = await Promise.all([
        fetch(`/api/marketing/automation?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' }),
        fetch(`/api/ai/models?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' }),
      ]);
      const dashboard = await dashboardRes.json();
      const modelData = await modelsRes.json();
      if (!dashboardRes.ok) throw new Error(dashboard.error || 'Unable to load automation data');
      if (dashboard.profile) setProfile({
        industry: dashboard.profile.industry, businessName: dashboard.profile.business_name,
        audience: dashboard.profile.audience, valueProposition: dashboard.profile.value_proposition,
        websiteUrl: dashboard.profile.website_url || '', timezone: dashboard.profile.default_timezone,
        approvalRequired: dashboard.profile.approval_required,
      });
      setChannelRows(dashboard.channels || []);
      setRequests(dashboard.requests || []);
      setModels(modelData.models || []);
      const defaultName = modelData.defaultModel || '';
      const enabledChannels = (dashboard.channels || []).filter((row: Channel) => row.enabled).map((row: Channel) => row.channel);
      setCampaign(c => ({ ...c, modelName: c.modelName || defaultName, channels: c.channels.filter(channel => enabledChannels.includes(channel)) }));
      setMessage('Tenant configuration loaded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Load failed');
    } finally { setBusy(false); }
  }, [tenantId]);

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/marketing/automation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, ...payload }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const saveProfile = async () => {
    setBusy(true);
    try { await post({ action: 'save_profile', ...profile }); setMessage('Business profile saved.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Save failed'); }
    finally { setBusy(false); }
  };

  const toggleChannel = async (channel: string) => {
    const enabled = !(configuredChannels[channel]?.enabled ?? false);
    try {
      await post({ action: 'set_channel', channel, enabled, provider: channel === 'youtube' ? 'youtube_data_api' : 'postiz' });
      setChannelRows(rows => [...rows.filter(r => r.channel !== channel), { channel, enabled, connection_status: configuredChannels[channel]?.connection_status || 'not_connected', provider: channel === 'youtube' ? 'youtube_data_api' : 'postiz' }]);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Channel update failed'); }
  };

  const updateModel = async (model: Model, change: Partial<Model>) => {
    try {
      const next = { ...model, ...change };
      const res = await fetch('/api/ai/models', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, modelName: model.name, enabled: next.enabled, isDefault: next.isDefault, purpose: next.purpose }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Model update failed');
      setModels(rows => rows.map(r => ({ ...r, isDefault: next.isDefault ? r.name === model.name : r.isDefault, ...(r.name === model.name ? next : {}) })));
      if (next.isDefault) setCampaign(c => ({ ...c, modelName: model.name }));
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Model update failed'); }
  };

  const createCampaign = async () => {
    setBusy(true);
    try {
      const data = await post({ action: 'create_campaign', industry: profile.industry, timezone: profile.timezone, ...campaign });
      setMessage(`Campaign queued: ${data.id}. Ollama will generate the first draft.`);
      setCampaign(c => ({ ...initialCampaign, modelName: c.modelName }));
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Campaign creation failed'); }
    finally { setBusy(false); }
  };

  const toggleList = (key: 'assetTypes' | 'channels', value: string) => setCampaign(c => ({ ...c, [key]: c[key].includes(value) ? c[key].filter(v => v !== value) : [...c[key], value] }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Marketing Automation Command Centre</h1><p className="mt-1 text-sm text-gray-500">Create, approve, schedule, and publish industry-specific campaigns from one tenant-aware workspace.</p></div>
      <div className="flex flex-col gap-2 rounded-xl border bg-white p-4 sm:flex-row">
        <input value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="Tenant UUID" className="flex-1 rounded-lg border px-3 py-2 text-sm" />
        <button disabled={!tenantId || busy} onClick={load} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-40">Load workspace</button>
        <span className="self-center text-xs text-gray-500">{message}</span>
      </div>

      <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">1. Customer business profile</h2><p className="mb-4 text-xs text-gray-500">Used by Ollama to produce relevant Yoga, Dental, or other industry content.</p>
        <div className="grid gap-3 md:grid-cols-3">
          <select value={profile.industry} onChange={e => setProfile(p => ({ ...p, industry: e.target.value }))} className="rounded-lg border p-2 text-sm">{INDUSTRIES.map(v => <option key={v}>{v}</option>)}</select>
          <input value={profile.businessName} onChange={e => setProfile(p => ({ ...p, businessName: e.target.value }))} placeholder="Business name" className="rounded-lg border p-2 text-sm" />
          <input value={profile.websiteUrl} onChange={e => setProfile(p => ({ ...p, websiteUrl: e.target.value }))} placeholder="Website URL" className="rounded-lg border p-2 text-sm" />
          <input value={profile.audience} onChange={e => setProfile(p => ({ ...p, audience: e.target.value }))} placeholder="Target audience" className="rounded-lg border p-2 text-sm" />
          <input value={profile.valueProposition} onChange={e => setProfile(p => ({ ...p, valueProposition: e.target.value }))} placeholder="Value proposition" className="rounded-lg border p-2 text-sm" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={profile.approvalRequired} onChange={e => setProfile(p => ({ ...p, approvalRequired: e.target.checked }))} /> Require admin approval</label>
        </div><button disabled={!tenantId || busy} onClick={saveProfile} className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40">Save profile</button>
      </section>

      <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">2. Developer accounts and publishing channels</h2><p className="mb-4 text-xs text-gray-500">Enabling a channel allows campaign selection; publishing remains blocked until its OAuth/developer account is connected.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{CHANNELS.map(ch => { const row = configuredChannels[ch]; return <button key={ch} disabled={!tenantId} onClick={() => toggleChannel(ch)} className={`rounded-lg border p-3 text-left ${row?.enabled ? 'border-green-400 bg-green-50' : 'bg-gray-50'}`}><span className="block text-sm font-medium">{ch}</span><span className="text-xs text-gray-500">{row?.enabled ? 'Enabled' : 'Disabled'} · {row?.connection_status || 'not connected'}</span></button>; })}</div>
      </section>

      <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">3. Local Ollama models</h2><p className="mb-4 text-xs text-gray-500">No AI API token is needed. Disable models a tenant should not use and choose one default.</p>
        <div className="max-h-72 overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-gray-500"><th className="p-2">Model</th><th>Purpose</th><th>Enabled</th><th>Default</th></tr></thead><tbody>{models.map(m => <tr key={m.name} className="border-b"><td className="p-2 font-mono text-xs">{m.name}</td><td><select value={m.purpose} onChange={e => updateModel(m, { purpose: e.target.value })} className="rounded border p-1 text-xs">{['general','copy','code','image_prompt','video_script','embedding'].map(p => <option key={p}>{p}</option>)}</select></td><td><input type="checkbox" checked={m.enabled} onChange={e => updateModel(m, { enabled: e.target.checked, isDefault: e.target.checked && m.isDefault })} /></td><td><input type="radio" name="defaultModel" checked={m.isDefault} disabled={!m.enabled} onChange={() => updateModel(m, { isDefault: true })} /></td></tr>)}</tbody></table></div>
      </section>

      <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">4. Create complete campaign</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2"><input value={campaign.title} onChange={e => setCampaign(c => ({ ...c, title: e.target.value }))} placeholder="Campaign title" className="rounded-lg border p-2 text-sm" /><select value={campaign.objective} onChange={e => setCampaign(c => ({ ...c, objective: e.target.value }))} className="rounded-lg border p-2 text-sm">{['awareness','lead_generation','booking','sale','event','education'].map(v => <option key={v}>{v}</option>)}</select><input value={campaign.audience} onChange={e => setCampaign(c => ({ ...c, audience: e.target.value }))} placeholder="Campaign audience" className="rounded-lg border p-2 text-sm" /><input value={campaign.offerText} onChange={e => setCampaign(c => ({ ...c, offerText: e.target.value }))} placeholder="Offer/message" className="rounded-lg border p-2 text-sm" /><input value={campaign.callToAction} onChange={e => setCampaign(c => ({ ...c, callToAction: e.target.value }))} placeholder="Call to action" className="rounded-lg border p-2 text-sm" /><input type="datetime-local" value={campaign.scheduledAt} onChange={e => setCampaign(c => ({ ...c, scheduledAt: e.target.value }))} className="rounded-lg border p-2 text-sm" /></div>
        <p className="mt-4 text-xs font-semibold uppercase text-gray-500">Assets</p><div className="mt-2 flex flex-wrap gap-2">{ASSETS.map(([id,label]) => <button key={id} onClick={() => toggleList('assetTypes', id)} className={`rounded-full border px-3 py-1 text-xs ${campaign.assetTypes.includes(id) ? 'bg-indigo-600 text-white' : ''}`}>{label}</button>)}</div>
        <p className="mt-4 text-xs font-semibold uppercase text-gray-500">Channels</p><div className="mt-2 flex flex-wrap gap-2">{CHANNELS.filter(ch => configuredChannels[ch]?.enabled).map(ch => <button key={ch} onClick={() => toggleList('channels', ch)} className={`rounded-full border px-3 py-1 text-xs ${campaign.channels.includes(ch) ? 'bg-green-600 text-white' : ''}`}>{ch}</button>)}</div>
        <button disabled={!tenantId || !campaign.title || busy} onClick={createCampaign} className="mt-5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-40">Generate with Ollama</button>
      </section>

      <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Process flow and responsibilities</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{FLOW.map(([n,title,desc]) => <div key={n} className="rounded-lg border p-3"><span className="mr-2 rounded-full bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">{n}</span><strong className="text-sm">{title}</strong><p className="mt-2 text-xs text-gray-500">{desc}</p></div>)}</div></section>

      <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Campaign workflow queue</h2><div className="mt-3 overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-gray-500"><th className="p-2">Campaign</th><th>Assets</th><th>Channels</th><th>Stage</th><th>Progress</th><th>Status</th></tr></thead><tbody>{requests.map(r => <tr key={r.id} className="border-b"><td className="p-2 font-medium">{r.title}<div className="text-xs text-gray-400">{r.industry} · {r.model_name || 'tenant default'}</div></td><td>{r.asset_types?.join(', ')}</td><td>{r.channels?.join(', ')}</td><td>{r.current_stage}</td><td>{r.progress_percent}%</td><td><span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">{r.status}</span></td></tr>)}</tbody></table>{!requests.length && <p className="p-4 text-sm text-gray-500">No campaigns loaded.</p>}</div></section>
    </div>
  );
}
