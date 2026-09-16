'use client';
import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Partner = {
  id: string; name: string; email: string; website: string | null;
  niche: string | null; audience_size: number; tier: string; status: string;
  commission_rate_bps: number; custom_rate_override: boolean;
  total_clicks: number; total_conversions: number; total_earned: string;
  total_paid: string; lifetime_gmv: string; outstanding_balance: string;
  conv_rate: string; created_at: string; approved_at: string | null;
  application_notes: string | null; rejection_reason: string | null;
  social_handles: Record<string, string>;
};

type TierRule = {
  id: string; tier: string; min_gmv: string; min_conversions: number;
  commission_rate_bps: number; sub_commission_rate_bps: number; description: string | null;
};

type Campaign = {
  id: string; name: string; description: string | null; bonus_rate_bps: number;
  start_date: string | null; end_date: string | null; status: string;
  total_conversions: number; total_bonus_paid: string; min_sale_amount: string;
};

type Material = {
  id: string; title: string; type: string; format: string | null;
  platform: string | null; file_url: string | null; copy_text: string | null;
  cta_text: string | null; utm_preset: string | null; is_active: boolean;
  download_count: number; created_at: string;
};

type FraudFlag = {
  id: string; partner_id: string; partner_name: string; partner_email: string;
  flag_type: string; detail: Record<string, unknown>; severity: string;
  status: string; reviewed_by: string | null; created_at: string;
};

type Payout = {
  id: string; partner_id: string; partner_name: string; partner_email: string;
  period: string; amount: string; status: string; payment_method: string | null;
  payment_reference: string | null; paid_at: string | null; created_at: string;
};

type Stats = {
  active_count: string; pending_count: string; total_count: string;
  total_gmv: string; total_earned: string; total_paid: string;
  outstanding: string; avg_rate_pct: string;
};

type Outstanding = {
  id: string; name: string; email: string; tier: string;
  total_earned: string; total_paid: string; balance: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ['overview', 'partners', 'tiers', 'campaigns', 'materials', 'fraud', 'payouts', 'tracking', 'report', 'dashboard', 'manual', 'pipeline'] as const;
type Tab = typeof TABS[number];

const TIER_COLORS: Record<string, string> = {
  bronze: 'bg-orange-100 text-orange-800',
  silver: 'bg-gray-100 text-gray-800',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-purple-100 text-purple-800',
};

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-gray-100 text-gray-600',
};

const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
};

const PAYOUT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>{label}</span>;
}

function fmtMoney(val: string | number | null | undefined) {
  const n = Number(val ?? 0);
  return isNaN(n) ? '$0.00' : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtRate(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border p-4 space-y-1">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AffiliatesAdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [tiers, setTiers] = useState<TierRule[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>([]);
  const [fraudSummary, setFraudSummary] = useState<Record<string, string>>({});
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [outstanding, setOutstanding] = useState<Outstanding[]>([]);
  const [payoutSummary, setPayoutSummary] = useState<Record<string, string>>({});
  const [cuspPartners, setCuspPartners] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [partnerTierFilter, setPartnerTierFilter] = useState('');
  const [partnerStatusFilter, setPartnerStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pRes, camRes, matRes, fraudRes, payRes, tierRes] = await Promise.all([
        fetch('/api/admin/affiliate-partners').then(r => r.json()),
        fetch('/api/admin/affiliate-campaigns').then(r => r.json()),
        fetch('/api/admin/affiliate-materials').then(r => r.json()),
        fetch('/api/admin/affiliate-fraud').then(r => r.json()),
        fetch('/api/admin/affiliate-payouts').then(r => r.json()),
        fetch('/api/admin/affiliate-tiers').then(r => r.json()),
      ]);
      setPartners(pRes.partners ?? []);
      setTiers(pRes.tiers ?? []);
      setStats(pRes.stats ?? null);
      setCampaigns(camRes.campaigns ?? []);
      setMaterials(matRes.materials ?? []);
      setFraudFlags(fraudRes.flags ?? []);
      setFraudSummary(fraudRes.summary ?? {});
      setPayouts(payRes.payouts ?? []);
      setOutstanding(payRes.outstanding ?? []);
      setPayoutSummary(payRes.summary ?? {});
      setCuspPartners(tierRes.partners_cusp ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doAction(url: string, body: Record<string, unknown>, successMsg?: string) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Request failed');
      setSuccess(successMsg ?? 'Done.');
      await load();
      return j;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  const filteredPartners = partners.filter(p => {
    const matchSearch = !partnerSearch || p.name.toLowerCase().includes(partnerSearch.toLowerCase()) || p.email.toLowerCase().includes(partnerSearch.toLowerCase());
    const matchTier = !partnerTierFilter || p.tier === partnerTierFilter;
    const matchStatus = !partnerStatusFilter || p.status === partnerStatusFilter;
    return matchSearch && matchTier && matchStatus;
  });

  function renderOverview() {
    if (!stats) return <p className="text-gray-500">Loading...</p>;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total Partners" value={stats.total_count} />
          <KpiCard label="Active Partners" value={stats.active_count} />
          <KpiCard label="Pending Approval" value={stats.pending_count} />
          <KpiCard label="Avg Commission Rate" value={`${stats.avg_rate_pct}%`} />
          <KpiCard label="Total GMV" value={fmtMoney(stats.total_gmv)} sub="lifetime" />
          <KpiCard label="Commissions Earned" value={fmtMoney(stats.total_earned)} />
          <KpiCard label="Commissions Paid" value={fmtMoney(stats.total_paid)} />
          <KpiCard label="Outstanding Balance" value={fmtMoney(stats.outstanding)} />
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Partner Tier Distribution</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['bronze', 'silver', 'gold', 'platinum'].map(tier => {
              const count = partners.filter(p => p.tier === tier).length;
              return (
                <div key={tier} className={`rounded-lg p-3 ${TIER_COLORS[tier]}`}>
                  <p className="text-sm font-semibold capitalize">{tier}</p>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs opacity-75">partners</p>
                </div>
              );
            })}
          </div>
        </div>
        {Number(stats.pending_count) > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <h2 className="font-semibold text-yellow-800 mb-2">{stats.pending_count} Application(s) Awaiting Review</h2>
            <div className="space-y-2">
              {partners.filter(p => p.status === 'pending').map(p => (
                <div key={p.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-yellow-100">
                  <div>
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="text-sm text-gray-500">{p.email} — {p.niche}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => doAction('/api/admin/affiliate-partners', { action: 'approve', id: p.id }, `${p.name} approved`)} disabled={busy} className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">Approve</button>
                    <button onClick={() => doAction('/api/admin/affiliate-partners', { action: 'reject', id: p.id, rejection_reason: 'Does not meet criteria' }, `${p.name} rejected`)} disabled={busy} className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {Number(fraudSummary.high_severity_open ?? 0) > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="font-semibold text-red-800">{fraudSummary.high_severity_open} High-Severity Fraud Flag(s) Open —{' '}
              <button onClick={() => setTab('fraud')} className="underline">Review in Fraud tab</button>
            </p>
          </div>
        )}
      </div>
    );
  }

  function renderPartners() {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <input type="text" placeholder="Search by name or email..." value={partnerSearch} onChange={e => setPartnerSearch(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-0" />
          <select value={partnerTierFilter} onChange={e => setPartnerTierFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Tiers</option>
            {['bronze', 'silver', 'gold', 'platinum'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <select value={partnerStatusFilter} onChange={e => setPartnerStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            {['approved', 'pending', 'rejected', 'suspended'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <span className="text-sm text-gray-500 self-center">{filteredPartners.length} results</span>
        </div>
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Name', 'Tier', 'Status', 'Clicks', 'Conv', 'Conv%', 'Earned', 'Outstanding', 'Actions'].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {filteredPartners.map(p => (
                <tbody key={p.id}>
                  <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedPartnerId(expandedPartnerId === p.id ? null : p.id)}>
                    <td className="px-3 py-3"><p className="font-medium text-gray-900">{p.name}</p><p className="text-xs text-gray-400">{p.email}</p></td>
                    <td className="px-3 py-3"><Badge label={p.tier} colorClass={TIER_COLORS[p.tier] ?? 'bg-gray-100 text-gray-600'} /></td>
                    <td className="px-3 py-3"><Badge label={p.status} colorClass={STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'} /></td>
                    <td className="px-3 py-3">{p.total_clicks.toLocaleString()}</td>
                    <td className="px-3 py-3">{p.total_conversions.toLocaleString()}</td>
                    <td className="px-3 py-3">{p.conv_rate}%</td>
                    <td className="px-3 py-3">{fmtMoney(p.total_earned)}</td>
                    <td className="px-3 py-3 font-medium text-orange-700">{fmtMoney(p.outstanding_balance)}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        {p.status === 'pending' && <button onClick={() => doAction('/api/admin/affiliate-partners', { action: 'approve', id: p.id }, 'Approved')} disabled={busy} className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50">Approve</button>}
                        {p.status === 'approved' && <button onClick={() => doAction('/api/admin/affiliate-partners', { action: 'suspend', id: p.id }, 'Suspended')} disabled={busy} className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 disabled:opacity-50">Suspend</button>}
                        {p.status !== 'approved' && p.status !== 'pending' && <button onClick={() => doAction('/api/admin/affiliate-partners', { action: 'approve', id: p.id }, 'Reinstated')} disabled={busy} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">Reinstate</button>}
                      </div>
                    </td>
                  </tr>
                  {expandedPartnerId === p.id && (
                    <tr>
                      <td colSpan={9} className="px-4 py-4 bg-gray-50 border-b">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2">PARTNER DETAILS</p>
                            <div className="space-y-1 text-sm">
                              <p><span className="text-gray-500">Website:</span> {p.website ? <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{p.website}</a> : '—'}</p>
                              <p><span className="text-gray-500">Niche:</span> {p.niche ?? '—'}</p>
                              <p><span className="text-gray-500">Audience:</span> {p.audience_size.toLocaleString()}</p>
                              <p><span className="text-gray-500">Applied:</span> {new Date(p.created_at).toLocaleDateString()}</p>
                              {p.approved_at && <p><span className="text-gray-500">Approved:</span> {new Date(p.approved_at).toLocaleDateString()}</p>}
                              {p.application_notes && <p><span className="text-gray-500">Notes:</span> {p.application_notes}</p>}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2">EARNINGS BREAKDOWN</p>
                            <div className="space-y-1 text-sm">
                              <p><span className="text-gray-500">Lifetime GMV:</span> {fmtMoney(p.lifetime_gmv)}</p>
                              <p><span className="text-gray-500">Total Earned:</span> {fmtMoney(p.total_earned)}</p>
                              <p><span className="text-gray-500">Total Paid:</span> {fmtMoney(p.total_paid)}</p>
                              <p><span className="text-gray-500">Outstanding:</span> <strong>{fmtMoney(p.outstanding_balance)}</strong></p>
                              <p><span className="text-gray-500">Commission:</span> {fmtRate(p.commission_rate_bps)} {p.custom_rate_override && <span className="text-xs text-orange-600">(custom override)</span>}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2">EDIT COMMISSION RATE</p>
                            <form onSubmit={async e => { e.preventDefault(); const fd = new FormData(e.currentTarget); await doAction(`/api/admin/affiliate-partners/${p.id}`, { commission_rate_bps: Math.round(Number(fd.get('rate')) * 100), custom_rate_override: true }, 'Rate updated'); }} className="flex gap-2 items-end">
                              <div><label className="block text-xs text-gray-500 mb-1">Rate %</label><input name="rate" type="number" min="0" max="100" step="0.01" defaultValue={(p.commission_rate_bps / 100).toFixed(2)} className="border rounded px-2 py-1 w-24 text-sm" /></div>
                              <button disabled={busy} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">Save</button>
                            </form>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              ))}
              {!filteredPartners.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No partners found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderTiers() {
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Tier Rules</h2>
          <button onClick={() => doAction('/api/admin/affiliate-partners', { action: 'promote_tiers' }, 'Tier promotion complete')} disabled={busy} className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50">Promote Partners (Auto)</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...tiers].sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)).map(tier => (
            <div key={tier.id} className={`rounded-xl border p-5 ${TIER_COLORS[tier.tier] ?? 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl capitalize font-bold">{tier.tier}</span>
                <Badge label={`${fmtRate(tier.commission_rate_bps)} base`} colorClass="bg-white text-gray-700 border" />
                <Badge label={`${fmtRate(tier.sub_commission_rate_bps)} sub`} colorClass="bg-white text-gray-500 border" />
              </div>
              <p className="text-sm mb-3">{tier.description}</p>
              <form onSubmit={async e => { e.preventDefault(); const fd = new FormData(e.currentTarget); await doAction('/api/admin/affiliate-tiers', { tier: tier.tier, min_gmv: Number(fd.get('min_gmv')), min_conversions: Number(fd.get('min_conversions')), commission_rate_bps: Math.round(Number(fd.get('rate')) * 100), sub_commission_rate_bps: Math.round(Number(fd.get('sub_rate')) * 100), description: fd.get('description') }, `${tier.tier} tier updated`); }} className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-xs font-medium mb-1">Min GMV ($)</label><input name="min_gmv" type="number" min="0" step="1" defaultValue={tier.min_gmv} className="w-full border rounded px-2 py-1 text-sm bg-white" /></div>
                  <div><label className="block text-xs font-medium mb-1">Min Conversions</label><input name="min_conversions" type="number" min="0" step="1" defaultValue={tier.min_conversions} className="w-full border rounded px-2 py-1 text-sm bg-white" /></div>
                  <div><label className="block text-xs font-medium mb-1">Commission %</label><input name="rate" type="number" min="0" max="100" step="0.01" defaultValue={(tier.commission_rate_bps / 100).toFixed(2)} className="w-full border rounded px-2 py-1 text-sm bg-white" /></div>
                  <div><label className="block text-xs font-medium mb-1">Sub-Affiliate %</label><input name="sub_rate" type="number" min="0" max="100" step="0.01" defaultValue={(tier.sub_commission_rate_bps / 100).toFixed(2)} className="w-full border rounded px-2 py-1 text-sm bg-white" /></div>
                </div>
                <div><label className="block text-xs font-medium mb-1">Description</label><input name="description" type="text" defaultValue={tier.description ?? ''} className="w-full border rounded px-2 py-1 text-sm bg-white" /></div>
                <button disabled={busy} className="px-4 py-1.5 bg-white border text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium">Save Tier Rules</button>
              </form>
              <div className="mt-3 text-xs text-gray-600">Partners at this tier: <strong>{partners.filter(p => p.tier === tier.tier).length}</strong></div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Partners Near Tier Upgrade</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{['Partner', 'Current Tier', 'Next Tier', 'Lifetime GMV', 'GMV to Next', 'Conversions'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {(cuspPartners as { id: string; name: string; email: string; tier: string; lifetime_gmv: string; total_conversions: number; next_tier: string | null; next_tier_gmv_threshold: string | null }[]).slice(0, 15).map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2"><p className="font-medium">{p.name}</p><p className="text-xs text-gray-400">{p.email}</p></td>
                  <td className="px-3 py-2"><Badge label={p.tier} colorClass={TIER_COLORS[p.tier] ?? 'bg-gray-100 text-gray-600'} /></td>
                  <td className="px-3 py-2">{p.next_tier ? <Badge label={p.next_tier} colorClass={TIER_COLORS[p.next_tier] ?? 'bg-gray-100 text-gray-600'} /> : '—'}</td>
                  <td className="px-3 py-2">{fmtMoney(p.lifetime_gmv)}</td>
                  <td className="px-3 py-2">{p.next_tier_gmv_threshold ? fmtMoney(Number(p.next_tier_gmv_threshold) - Number(p.lifetime_gmv)) : '—'}</td>
                  <td className="px-3 py-2">{p.total_conversions}</td>
                </tr>
              ))}
              {!cuspPartners.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No data.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderCampaigns() {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-800">Affiliate Campaigns</h2>
        <form onSubmit={async e => { e.preventDefault(); const fd = new FormData(e.currentTarget); await doAction('/api/admin/affiliate-campaigns', { name: fd.get('name'), description: fd.get('description'), bonus_rate_bps: Math.round(Number(fd.get('bonus')) * 100), start_date: fd.get('start_date') || null, end_date: fd.get('end_date') || null, min_sale_amount: Number(fd.get('min_sale')), status: fd.get('status') }, 'Campaign created'); (e.target as HTMLFormElement).reset(); }} className="bg-gray-50 rounded-xl border p-4 space-y-3">
          <h3 className="font-medium text-gray-800">Create New Campaign</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input name="name" type="text" placeholder="Campaign Name *" required className="border rounded-lg px-3 py-2 text-sm" />
            <input name="description" type="text" placeholder="Description" className="border rounded-lg px-3 py-2 text-sm" />
            <input name="bonus" type="number" min="0" max="100" step="0.01" placeholder="Bonus Commission %" className="border rounded-lg px-3 py-2 text-sm" />
            <input name="start_date" type="datetime-local" className="border rounded-lg px-3 py-2 text-sm" />
            <input name="end_date" type="datetime-local" className="border rounded-lg px-3 py-2 text-sm" />
            <input name="min_sale" type="number" min="0" step="0.01" placeholder="Min Sale Amount ($)" className="border rounded-lg px-3 py-2 text-sm" />
            <select name="status" className="border rounded-lg px-3 py-2 text-sm"><option value="draft">Draft</option><option value="active">Active</option></select>
          </div>
          <button disabled={busy} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">Create Campaign</button>
        </form>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map(c => (
            <div key={c.id} className="bg-white rounded-xl border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{c.name}</h3>
                <div className="flex items-center gap-2">
                  <Badge label={`+${fmtRate(c.bonus_rate_bps)} bonus`} colorClass="bg-green-100 text-green-700" />
                  <Badge label={c.status} colorClass={c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} />
                </div>
              </div>
              {c.description && <p className="text-sm text-gray-600">{c.description}</p>}
              <div className="text-xs text-gray-500 grid grid-cols-2 gap-1">
                <span>Min Sale: {fmtMoney(c.min_sale_amount)}</span>
                <span>Conversions: {c.total_conversions}</span>
                {c.start_date && <span>Start: {new Date(c.start_date).toLocaleDateString()}</span>}
                {c.end_date && <span>End: {new Date(c.end_date).toLocaleDateString()}</span>}
              </div>
              <div className="flex gap-2 pt-1">
                {c.status === 'draft' && <button onClick={() => doAction('/api/admin/affiliate-campaigns', { action: 'update', id: c.id, name: c.name, status: 'active' }, 'Campaign activated')} disabled={busy} className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50">Activate</button>}
                {c.status === 'active' && <button onClick={() => doAction('/api/admin/affiliate-campaigns', { action: 'update', id: c.id, name: c.name, status: 'paused' }, 'Campaign paused')} disabled={busy} className="px-2 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 disabled:opacity-50">Pause</button>}
                <button onClick={() => doAction('/api/admin/affiliate-campaigns', { action: 'delete', id: c.id }, 'Campaign deleted')} disabled={busy} className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50">Delete</button>
              </div>
            </div>
          ))}
          {!campaigns.length && <p className="text-gray-400 col-span-2">No campaigns yet.</p>}
        </div>
      </div>
    );
  }

  function renderMaterials() {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-800">Marketing Materials</h2>
        <form onSubmit={async e => { e.preventDefault(); const fd = new FormData(e.currentTarget); await doAction('/api/admin/affiliate-materials', { title: fd.get('title'), type: fd.get('type'), format: fd.get('format') || null, platform: fd.get('platform') || null, file_url: fd.get('file_url') || null, copy_text: fd.get('copy_text') || null, cta_text: fd.get('cta_text') || null, utm_preset: fd.get('utm_preset') || null }, 'Material created'); (e.target as HTMLFormElement).reset(); }} className="bg-gray-50 rounded-xl border p-4 space-y-3">
          <h3 className="font-medium text-gray-800">Add New Material</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input name="title" type="text" placeholder="Title *" required className="border rounded-lg px-3 py-2 text-sm" />
            <select name="type" required className="border rounded-lg px-3 py-2 text-sm"><option value="">Type *</option><option value="banner">Banner</option><option value="email_copy">Email Copy</option><option value="social_copy">Social Copy</option><option value="landing_page">Landing Page</option><option value="video">Video</option></select>
            <select name="platform" className="border rounded-lg px-3 py-2 text-sm"><option value="">Platform (any)</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="email">Email</option><option value="blog">Blog</option><option value="general">General</option></select>
            <input name="format" type="text" placeholder="Format (e.g. 728x90)" className="border rounded-lg px-3 py-2 text-sm" />
            <input name="file_url" type="url" placeholder="File URL" className="border rounded-lg px-3 py-2 text-sm" />
            <input name="cta_text" type="text" placeholder="CTA Text" className="border rounded-lg px-3 py-2 text-sm" />
            <input name="utm_preset" type="text" placeholder="UTM preset string" className="border rounded-lg px-3 py-2 text-sm col-span-2" />
          </div>
          <textarea name="copy_text" placeholder="Copy text (for email/social templates)" rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <button disabled={busy} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">Add Material</button>
        </form>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map(m => (
            <div key={m.id} className="bg-white rounded-xl border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{m.title}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge label={m.type} colorClass="bg-blue-50 text-blue-700" />
                    {m.format && <Badge label={m.format} colorClass="bg-gray-100 text-gray-600" />}
                    {m.platform && <Badge label={m.platform} colorClass="bg-purple-50 text-purple-700" />}
                  </div>
                </div>
                <span className="text-xs text-gray-400">{m.download_count} downloads</span>
              </div>
              {m.copy_text && <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 max-h-20 overflow-y-auto">{m.copy_text.substring(0, 150)}{m.copy_text.length > 150 ? '...' : ''}</div>}
              {m.utm_preset && (
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 truncate">{m.utm_preset}</code>
                  <button onClick={() => { navigator.clipboard.writeText(m.utm_preset ?? ''); setSuccess('UTM copied!'); }} className="text-xs text-blue-600 hover:underline whitespace-nowrap">Copy</button>
                </div>
              )}
              <div className="flex gap-2">
                {m.copy_text && <button onClick={() => { navigator.clipboard.writeText(m.copy_text ?? ''); setSuccess('Copied!'); doAction('/api/admin/affiliate-materials', { action: 'download', id: m.id }); }} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">Copy Text</button>}
                {m.file_url && <a href={m.file_url} target="_blank" rel="noopener noreferrer" onClick={() => doAction('/api/admin/affiliate-materials', { action: 'download', id: m.id })} className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">Download</a>}
                <button onClick={() => doAction('/api/admin/affiliate-materials', { action: 'toggle', id: m.id }, 'Toggled')} disabled={busy} className={`px-2 py-1 text-xs rounded ${m.is_active ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}`}>{m.is_active ? 'Deactivate' : 'Activate'}</button>
              </div>
            </div>
          ))}
          {!materials.length && <p className="text-gray-400 col-span-3">No materials yet.</p>}
        </div>
      </div>
    );
  }

  function renderFraud() {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Open Flags" value={fraudSummary.open_count ?? '0'} />
          <KpiCard label="High Severity Open" value={fraudSummary.high_severity_open ?? '0'} />
          <KpiCard label="Actioned" value={fraudSummary.actioned_count ?? '0'} />
          <KpiCard label="Total Flags" value={fraudSummary.total_count ?? '0'} />
        </div>
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{['Partner', 'Flag Type', 'Severity', 'Status', 'Detail', 'Date', 'Actions'].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {fraudFlags.map(f => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3"><p className="font-medium">{f.partner_name ?? '—'}</p><p className="text-xs text-gray-400">{f.partner_email}</p></td>
                  <td className="px-3 py-3"><code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{f.flag_type}</code></td>
                  <td className="px-3 py-3"><Badge label={f.severity} colorClass={SEVERITY_COLORS[f.severity] ?? 'bg-gray-100 text-gray-600'} /></td>
                  <td className="px-3 py-3"><Badge label={f.status} colorClass={f.status === 'open' ? 'bg-yellow-100 text-yellow-700' : f.status === 'actioned' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'} /></td>
                  <td className="px-3 py-3 max-w-xs"><p className="text-xs text-gray-600 truncate">{JSON.stringify(f.detail)}</p></td>
                  <td className="px-3 py-3 text-xs text-gray-500">{new Date(f.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-3">
                    {f.status === 'open' && (
                      <div className="flex gap-1">
                        <button onClick={() => doAction('/api/admin/affiliate-fraud', { action: 'review', id: f.id, status: 'reviewed' }, 'Marked reviewed')} disabled={busy} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">Review</button>
                        <button onClick={() => doAction('/api/admin/affiliate-fraud', { action: 'review', id: f.id, status: 'dismissed' }, 'Dismissed')} disabled={busy} className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 disabled:opacity-50">Dismiss</button>
                        <button onClick={() => doAction('/api/admin/affiliate-fraud', { action: 'review', id: f.id, status: 'actioned', suspend_partner: true }, 'Actioned')} disabled={busy} className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50">Action+Suspend</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!fraudFlags.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No fraud flags found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-800 mb-2">Active Fraud Detection Thresholds</h2>
          <div className="text-sm text-gray-600 space-y-1">
            <p>Click flood threshold: <strong>200 clicks / 24 hours</strong> per partner</p>
            <p>IP cluster threshold: <strong>10 conversions</strong> from same /24 subnet within <strong>7 days</strong></p>
            <p>Self-referral: detected when partner uses their own referral code for a purchase</p>
            <p>Deduplication window: flags suppressed if same partner+type flagged within <strong>7 days</strong></p>
          </div>
        </div>
      </div>
    );
  }

  function renderPayouts() {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard label="Pending Payouts" value={fmtMoney(payoutSummary.pending_total)} sub={`${payoutSummary.pending_count ?? 0} batches`} />
          <KpiCard label="Paid Out (All Time)" value={fmtMoney(payoutSummary.paid_total)} />
          <KpiCard label="Partners with Balance" value={String(outstanding.length)} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => doAction('/api/admin/affiliate-payouts', { action: 'generate_batch' }, 'Payout batch generated')} disabled={busy} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">Generate Payout Batch</button>
          <p className="text-sm text-gray-500">Creates payout rows for all partners with balance &gt; $10. Idempotent per period.</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Outstanding Balances</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{['Partner', 'Tier', 'Earned', 'Paid', 'Balance'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {outstanding.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2"><p className="font-medium">{o.name}</p><p className="text-xs text-gray-400">{o.email}</p></td>
                  <td className="px-3 py-2"><Badge label={o.tier} colorClass={TIER_COLORS[o.tier] ?? 'bg-gray-100 text-gray-600'} /></td>
                  <td className="px-3 py-2">{fmtMoney(o.total_earned)}</td>
                  <td className="px-3 py-2">{fmtMoney(o.total_paid)}</td>
                  <td className="px-3 py-2 font-semibold text-orange-700">{fmtMoney(o.balance)}</td>
                </tr>
              ))}
              {!outstanding.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No outstanding balances.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Payout Batches</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{['Partner', 'Period', 'Amount', 'Status', 'Method', 'Reference', 'Mark Paid'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {payouts.map(po => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2"><p className="font-medium">{po.partner_name}</p><p className="text-xs text-gray-400">{po.partner_email}</p></td>
                  <td className="px-3 py-2">{po.period}</td>
                  <td className="px-3 py-2 font-medium">{fmtMoney(po.amount)}</td>
                  <td className="px-3 py-2"><Badge label={po.status} colorClass={PAYOUT_STATUS_COLORS[po.status] ?? 'bg-gray-100 text-gray-600'} /></td>
                  <td className="px-3 py-2 text-xs">{po.payment_method ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{po.payment_reference ?? '—'}</td>
                  <td className="px-3 py-2">
                    {po.status === 'pending' && (
                      <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); doAction('/api/admin/affiliate-payouts', { action: 'mark_paid', payout_id: po.id, payment_method: fd.get('method'), payment_reference: fd.get('ref') }, 'Payout marked paid'); }} className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <select name="method" required className="border rounded px-1 py-0.5 text-xs"><option value="">Method</option><option value="bank_transfer">Bank Transfer</option><option value="paypal">PayPal</option><option value="crypto">Crypto</option><option value="store_credit">Store Credit</option></select>
                        <input name="ref" placeholder="Reference" required className="border rounded px-1 py-0.5 text-xs w-24" />
                        <button disabled={busy} className="px-2 py-0.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50">Paid</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {!payouts.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No payout batches yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderTracking() {
    const approved = partners.filter(p => p.status === 'approved');
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Click and Conversion Tracking</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {['bronze', 'silver', 'gold', 'platinum'].map(tier => {
            const ps = approved.filter(p => p.tier === tier);
            const clicks = ps.reduce((s, p) => s + p.total_clicks, 0);
            const convs = ps.reduce((s, p) => s + p.total_conversions, 0);
            return (
              <div key={tier} className={`rounded-lg p-3 ${TIER_COLORS[tier]}`}>
                <p className="text-xs font-semibold capitalize">{tier} tier totals</p>
                <p className="text-sm">{clicks.toLocaleString()} clicks</p>
                <p className="text-sm">{convs.toLocaleString()} conversions</p>
              </div>
            );
          })}
        </div>
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{['Partner', 'Tier', 'Total Clicks', 'Total Conversions', 'Conv Rate', 'Lifetime GMV'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {approved.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2"><p className="font-medium">{p.name}</p><p className="text-xs text-gray-400">{p.niche}</p></td>
                  <td className="px-3 py-2"><Badge label={p.tier} colorClass={TIER_COLORS[p.tier] ?? 'bg-gray-100 text-gray-600'} /></td>
                  <td className="px-3 py-2">{p.total_clicks.toLocaleString()}</td>
                  <td className="px-3 py-2">{p.total_conversions.toLocaleString()}</td>
                  <td className="px-3 py-2">{p.conv_rate}%</td>
                  <td className="px-3 py-2">{fmtMoney(p.lifetime_gmv)}</td>
                </tr>
              ))}
              {!approved.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No approved partners yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderReport() {
    const approved = partners.filter(p => p.status === 'approved');
    const totalClicks = approved.reduce((s, p) => s + p.total_clicks, 0);
    const totalConversions = approved.reduce((s, p) => s + p.total_conversions, 0);
    const totalGmv = approved.reduce((s, p) => s + Number(p.lifetime_gmv), 0);
    const totalEarned = approved.reduce((s, p) => s + Number(p.total_earned), 0);
    const overallConvRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : '0';
    const topPartners = [...approved].sort((a, b) => b.total_conversions - a.total_conversions).slice(0, 10);
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-800">Affiliate Performance Report</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard label="Total Clicks" value={totalClicks.toLocaleString()} />
          <KpiCard label="Total Conversions" value={totalConversions.toLocaleString()} />
          <KpiCard label="Conv. Rate" value={`${overallConvRate}%`} />
          <KpiCard label="Total GMV" value={fmtMoney(totalGmv)} />
          <KpiCard label="Commissions Earned" value={fmtMoney(totalEarned)} />
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Top 10 Partners by Conversions</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>{['#', 'Partner', 'Tier', 'Clicks', 'Conversions', 'Conv%', 'GMV', 'Earned', 'Rate'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {topPartners.map((p, i) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400 font-bold">#{i + 1}</td>
                  <td className="px-3 py-2"><p className="font-medium">{p.name}</p><p className="text-xs text-gray-400">{p.niche}</p></td>
                  <td className="px-3 py-2"><Badge label={p.tier} colorClass={TIER_COLORS[p.tier] ?? 'bg-gray-100 text-gray-600'} /></td>
                  <td className="px-3 py-2">{p.total_clicks.toLocaleString()}</td>
                  <td className="px-3 py-2 font-medium">{p.total_conversions.toLocaleString()}</td>
                  <td className="px-3 py-2">{p.conv_rate}%</td>
                  <td className="px-3 py-2">{fmtMoney(p.lifetime_gmv)}</td>
                  <td className="px-3 py-2">{fmtMoney(p.total_earned)}</td>
                  <td className="px-3 py-2">{fmtRate(p.commission_rate_bps)}</td>
                </tr>
              ))}
              {!topPartners.length && <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">No approved partners.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderDashboard() {
    const approved = partners.filter(p => p.status === 'approved');
    const leaderboard = [...approved].sort((a, b) => b.total_conversions - a.total_conversions).slice(0, 10);
    const tierCounts: Record<string, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    partners.forEach(p => { if (p.tier in tierCounts) tierCounts[p.tier]++; });
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Active Partners" value={String(approved.length)} />
          <KpiCard label="Total GMV" value={fmtMoney(approved.reduce((s, p) => s + Number(p.lifetime_gmv), 0))} />
          <KpiCard label="Outstanding Payouts" value={fmtMoney(approved.reduce((s, p) => s + Number(p.outstanding_balance), 0))} />
          <KpiCard label="Open Fraud Flags" value={fraudSummary.open_count ?? '0'} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Partner Leaderboard</h2>
            <div className="space-y-2">
              {leaderboard.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-gray-300 text-gray-700' : i === 2 ? 'bg-orange-300 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400"><span>{p.total_conversions} conv</span><span>{fmtMoney(p.lifetime_gmv)} GMV</span></div>
                  </div>
                  <Badge label={p.tier} colorClass={TIER_COLORS[p.tier] ?? 'bg-gray-100 text-gray-600'} />
                </div>
              ))}
              {!leaderboard.length && <p className="text-gray-400 text-sm">No approved partners yet.</p>}
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Tier Distribution</h2>
            <div className="space-y-3">
              {Object.entries(tierCounts).map(([tier, count]) => {
                const pct = partners.length > 0 ? Math.round((count / partners.length) * 100) : 0;
                return (
                  <div key={tier}>
                    <div className="flex justify-between text-sm mb-1"><span className="capitalize">{tier}</span><span>{count} ({pct}%)</span></div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderManual() {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-800">Manual Affiliate Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-medium text-gray-800 mb-3">Manually Create Partner</h3>
            <form onSubmit={async e => { e.preventDefault(); const fd = new FormData(e.currentTarget); const result = await doAction('/api/admin/affiliate-partners', { action: 'create', name: fd.get('name'), email: fd.get('email'), website: fd.get('website') || null, niche: fd.get('niche') || null, audience_size: Number(fd.get('audience_size')) || 0, tier: fd.get('tier'), commission_rate_bps: Math.round(Number(fd.get('rate')) * 100), application_notes: fd.get('notes') || null }, 'Partner created'); if (result) (e.target as HTMLFormElement).reset(); }} className="space-y-3">
              <input name="name" type="text" placeholder="Name *" required className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input name="email" type="email" placeholder="Email *" required className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input name="website" type="url" placeholder="Website" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input name="niche" type="text" placeholder="Niche (yoga/fitness/wellness)" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input name="audience_size" type="number" min="0" placeholder="Audience Size" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-3">
                <select name="tier" className="flex-1 border rounded-lg px-3 py-2 text-sm"><option value="bronze">Bronze</option><option value="silver">Silver</option><option value="gold">Gold</option><option value="platinum">Platinum</option></select>
                <input name="rate" type="number" min="0" max="100" step="0.01" placeholder="Commission %" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              </div>
              <textarea name="notes" placeholder="Internal notes" rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <button disabled={busy} className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">Create Partner</button>
            </form>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-medium text-gray-800 mb-3">Manually Record Payout</h3>
            <form onSubmit={async e => { e.preventDefault(); const fd = new FormData(e.currentTarget); await doAction('/api/admin/affiliate-payouts', { action: 'mark_paid', payout_id: fd.get('payout_id'), payment_method: fd.get('method'), payment_reference: fd.get('reference') }, 'Payout recorded'); (e.target as HTMLFormElement).reset(); }} className="space-y-3">
              <p className="text-xs text-gray-500">First generate a payout batch (Payouts tab), then copy the payout ID to mark it as paid.</p>
              <input name="payout_id" type="text" placeholder="Payout ID (UUID) *" required className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
              <select name="method" required className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">Payment Method *</option><option value="bank_transfer">Bank Transfer</option><option value="paypal">PayPal</option><option value="crypto">Crypto</option><option value="store_credit">Store Credit</option></select>
              <input name="reference" type="text" placeholder="Payment Reference *" required className="w-full border rounded-lg px-3 py-2 text-sm" />
              <button disabled={busy} className="w-full py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">Record Payment</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  function renderPipeline() {
    const jobs = [
      { name: 'AffiliatePartnerTierJob', schedule: 'Weekly Sunday 02:00 UTC', description: 'Re-evaluates all partner tiers against affiliate_tier_rule thresholds. Promotes/demotes tier and commission rate. Flags inactive partners at_risk.' },
      { name: 'AffiliatePayoutJob', schedule: 'Monthly 1st 03:00 UTC', description: 'Creates affiliate_payout rows for all partners with balance > $10. Idempotent per partner+period.' },
      { name: 'AffiliateFraudScanJob', schedule: 'Daily 04:00 UTC', description: 'Scans for self-referrals, click flooding (>200/24h), IP clustering (>10 conv/subnet/7d). Inserts fraud flags, dedupes within 7 days.' },
      { name: 'AffiliateCommissionSettleJob', schedule: 'Daily 05:00 UTC', description: 'Settles pending commission rows where the linked order is confirmed/delivered. Updates partner total_earned.' },
    ];
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Affiliate Job Pipeline</h2>
        <div className="grid grid-cols-1 gap-3">
          {jobs.map(job => (
            <div key={job.name} className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3 mb-1">
                <code className="text-sm font-mono font-semibold text-gray-900">{job.name}</code>
                <Badge label={job.schedule} colorClass="bg-blue-50 text-blue-700" />
                <Badge label="Enabled" colorClass="bg-green-100 text-green-700" />
              </div>
              <p className="text-sm text-gray-600">{job.description}</p>
            </div>
          ))}
        </div>
        <div className="bg-gray-50 rounded-xl border p-4 text-sm text-gray-600">
          <p className="font-medium mb-1">Job Registry</p>
          <p>All 4 jobs are registered in <code className="text-xs bg-gray-200 px-1 rounded">CronRegistry.ts</code> and <code className="text-xs bg-gray-200 px-1 rounded">jobModules.ts</code>. Job run logs appear in <code className="text-xs bg-gray-200 px-1 rounded">job_run_log</code> when that table exists. Jobs execute in the cron runner container.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Affiliate Hub</h1>
        <p className="text-gray-500 text-sm mt-1">Manage affiliate partners, tiers, campaigns, payouts, and fraud detection.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm">{success}</div>}

      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-medium capitalize rounded-t-lg transition-colors ${tab === t ? 'bg-white border border-b-white -mb-px text-blue-700 border-gray-200' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === 'overview' && renderOverview()}
          {tab === 'partners' && renderPartners()}
          {tab === 'tiers' && renderTiers()}
          {tab === 'campaigns' && renderCampaigns()}
          {tab === 'materials' && renderMaterials()}
          {tab === 'fraud' && renderFraud()}
          {tab === 'payouts' && renderPayouts()}
          {tab === 'tracking' && renderTracking()}
          {tab === 'report' && renderReport()}
          {tab === 'dashboard' && renderDashboard()}
          {tab === 'manual' && renderManual()}
          {tab === 'pipeline' && renderPipeline()}
        </>
      )}
    </div>
  );
}
