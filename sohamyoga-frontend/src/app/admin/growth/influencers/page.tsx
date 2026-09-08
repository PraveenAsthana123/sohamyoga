'use client';
// /admin/growth/influencers — Influencer Engine (Phase D of the
// growth-loop architecture). Cross-platform on purpose — an influencer's
// identity isn't tied to one social platform, unlike viral detection.
// Real value score computed weekly by InfluencerValueJob from actual
// referral attribution (migration-052 referral domain); an influencer with
// no referral code issued yet is honestly shown as insufficient_data
// rather than a fabricated score.

import { Fragment, useEffect, useState } from 'react';

interface Influencer {
  id: string; handle: string; platform: string; followerCount: number; engagementRate: number | null;
  tier: string; status: string; hasReferralCode: boolean; referralCount: number; revenueAttributed: number;
  valueScore: number; valueStatus: string; aiNote: string | null;
}

interface Collaboration {
  id: string; campaignName: string; status: string; deliverables: string | null;
  compensationType: string | null; compensationValue: number | null; startedAt: string | null; completedAt: string | null;
  submittedContentUrl: string | null; submittedAt: string | null; publishedContentUrl: string | null; publishedAt: string | null;
}

const COLLAB_STATUS_COLOR: Record<string, string> = {
  identified: 'bg-gray-100 text-gray-600', contacted: 'bg-blue-100 text-blue-700', negotiating: 'bg-amber-100 text-amber-700',
  active: 'bg-indigo-100 text-indigo-700', completed: 'bg-green-100 text-green-700', declined: 'bg-red-100 text-red-700',
};
const COLLAB_NEXT: Record<string, string[]> = {
  identified: ['contacted', 'declined'], contacted: ['negotiating', 'declined'], negotiating: ['active', 'declined'],
  active: ['completed', 'declined'], completed: [], declined: [],
};

function ContentUrlInput({ placeholder, onSave }: { placeholder: string; onSave: (url: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="flex gap-1 flex-1">
      <input value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} className="flex-1 rounded border px-1.5 py-0.5 text-xs" />
      <button onClick={() => onSave(value)} disabled={!value.trim()} className="rounded bg-gray-200 px-1.5 py-0.5 text-xs disabled:opacity-50">Save</button>
    </div>
  );
}

// Real CRUD for influencer_collaboration -- previously a schema table with
// zero API routes or UI anywhere. Closes the brief/negotiation/contract/
// payment lifecycle gap for real (no fabricated e-signature or payment
// execution -- compensation is recorded, not processed).
function CollaborationPanel({ influencerId }: { influencerId: string }) {
  const [collabs, setCollabs] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignName, setCampaignName] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [compensationType, setCompensationType] = useState('none');
  const [compensationValue, setCompensationValue] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    fetch(`/api/admin/growth/influencers/${influencerId}/collaborations`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => setCollabs(d?.collaborations ?? [])).finally(() => setLoading(false));
  };
  useEffect(load, [influencerId]);

  async function create() {
    setError('');
    const res = await fetch(`/api/admin/growth/influencers/${influencerId}/collaborations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignName, deliverables, compensationType, compensationValue: compensationValue ? Number(compensationValue) : undefined }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error || 'Failed to create.'); return; }
    setCampaignName(''); setDeliverables(''); setCompensationValue('');
    load();
  }

  async function transition(id: string, status: string) {
    await fetch(`/api/admin/growth/collaborations/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    load();
  }

  async function submitContent(id: string, url: string) {
    if (!url.trim()) return;
    await fetch(`/api/admin/growth/collaborations/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submittedContentUrl: url.trim() }),
    });
    load();
  }

  async function publishContent(id: string, url: string) {
    if (!url.trim()) return;
    await fetch(`/api/admin/growth/collaborations/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publishedContentUrl: url.trim() }),
    });
    load();
  }

  return (
    <div className="mt-2 rounded-lg border bg-gray-50 p-3">
      {loading ? <p className="text-xs text-gray-400">Loading collaborations…</p> : (
        <div className="space-y-1.5">
          {collabs.map(c => (
            <div key={c.id} className="rounded bg-white border px-2 py-1.5 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{c.campaignName}</span>
                  {c.compensationType && c.compensationType !== 'none' && <span className="ml-2 text-gray-500">{c.compensationType}{c.compensationValue ? ` $${c.compensationValue}` : ''}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${COLLAB_STATUS_COLOR[c.status]}`}>{c.status}</span>
                  {(COLLAB_NEXT[c.status] ?? []).map(s => (
                    <button key={s} onClick={() => transition(c.id, s)} className="text-blue-600 hover:underline">{s}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                {c.submittedContentUrl
                  ? <span>Submitted: <a href={c.submittedContentUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{c.submittedContentUrl}</a></span>
                  : <ContentUrlInput placeholder="Submitted content URL…" onSave={(url) => submitContent(c.id, url)} />}
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                {c.publishedContentUrl
                  ? <span>Published: <a href={c.publishedContentUrl} target="_blank" rel="noreferrer" className="text-green-600 hover:underline">{c.publishedContentUrl}</a></span>
                  : <ContentUrlInput placeholder="Published content URL…" onSave={(url) => publishContent(c.id, url)} />}
              </div>
            </div>
          ))}
          {!collabs.length && <p className="text-xs text-gray-400">No collaborations yet.</p>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Campaign name" className="rounded border px-2 py-1 text-xs flex-1 min-w-[120px]" />
        <input value={deliverables} onChange={e => setDeliverables(e.target.value)} placeholder="Deliverables" className="rounded border px-2 py-1 text-xs flex-1 min-w-[120px]" />
        <select value={compensationType} onChange={e => setCompensationType(e.target.value)} className="rounded border px-2 py-1 text-xs">
          {['none', 'cash', 'free_class', 'membership', 'commission', 'product'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {compensationType !== 'none' && <input value={compensationValue} onChange={e => setCompensationValue(e.target.value)} type="number" placeholder="Value" className="rounded border px-2 py-1 text-xs w-20" />}
        <button onClick={create} disabled={!campaignName.trim()} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50">Add</button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const TIER_STYLE: Record<string, string> = {
  nano: 'bg-gray-100 text-gray-700', micro: 'bg-blue-100 text-blue-700', mid: 'bg-indigo-100 text-indigo-700',
  macro: 'bg-purple-100 text-purple-700', mega: 'bg-pink-100 text-pink-700',
};

export default function InfluencersPage() {
  const [data, setData] = useState<{ hasData: boolean; influencers: Influencer[] } | null>(null);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/growth/influencers', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div className="mx-auto max-w-5xl p-6"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="border-l-4 border-primary-600 pl-4">
        <h1 className="text-2xl font-bold">Influencers</h1>
        <p className="text-sm text-gray-500">
          Real value score from referral attribution (migration-052 referral domain) — never a fabricated reach/engagement number.
        </p>
      </header>

      {!data.hasData ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">
          No influencer profiles yet. Add one to influencer_profile (handle, platform, referral_code_id once a code is issued), then run
          "influencer-value" from the Demo Hub's Use Case Catalog.
        </div>
      ) : (
        <section className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Handle', 'Platform', 'Tier', 'Followers', 'Referrals', 'Revenue', 'Value Score', 'Note', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.influencers.map(inf => (
                <Fragment key={inf.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">@{inf.handle}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{inf.platform.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_STYLE[inf.tier] ?? ''}`}>{inf.tier}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{inf.followerCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">{inf.referralCount}</td>
                    <td className="px-4 py-3 text-gray-600">${inf.revenueAttributed.toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">
                      {inf.valueStatus === 'insufficient_data'
                        ? <span className="text-xs font-normal text-gray-400">insufficient data{!inf.hasReferralCode ? ' — no code issued' : ''}</span>
                        : inf.valueScore}
                    </td>
                    <td className="px-4 py-3 max-w-xs text-xs text-gray-500">{inf.aiNote ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setExpandedId(id => id === inf.id ? null : inf.id)} className="text-xs text-indigo-600 hover:underline">
                        {expandedId === inf.id ? 'Hide' : 'Collaborations'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === inf.id && (
                    <tr>
                      <td colSpan={9} className="bg-gray-50 px-4 py-3">
                        <CollaborationPanel influencerId={inf.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
