'use client';
import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Partner = {
  id: string; name: string; email: string; tier: string; status: string;
  commission_rate_bps: number; total_clicks: number; total_conversions: number;
  total_earned: string; total_paid: string; lifetime_gmv: string;
};

type ThisMonth = { clicks: number; conversions: number; earned: number };

type ReferralCode = {
  id: string; code: string; product_id: string | null; landing_url: string | null;
  qr_code_url: string | null; created_at: string;
};

type Material = {
  id: string; title: string; type: string; format: string | null;
  platform: string | null; file_url: string | null; copy_text: string | null;
  cta_text: string | null; utm_preset: string | null; download_count: number;
};

type Earning = {
  id: string; order_id: string; order_number: string | null;
  earned: string; reversed: string; paid: string; created_at: string;
};

type Payout = {
  id: string; period: string; amount: string; status: string;
  payment_method: string | null; payment_reference: string | null; paid_at: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ['dashboard', 'my-links', 'materials', 'earnings', 'payouts', 'apply'] as const;
type Tab = typeof TABS[number];

const TIER_COLORS: Record<string, string> = {
  bronze: 'bg-orange-100 text-orange-800',
  silver: 'bg-gray-100 text-gray-800',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-purple-100 text-purple-800',
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

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-800/70 border border-white/20 rounded-xl border p-4 space-y-1">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-white/40">{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CustomerAffiliatePage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [partner, setPartner] = useState<Partner | null>(null);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [thisMonth, setThisMonth] = useState<ThisMonth>({ clicks: 0, conversions: 0, earned: 0 });
  const [pendingPayout, setPendingPayout] = useState(0);
  const [recentLinks, setRecentLinks] = useState<ReferralCode[]>([]);
  const [recentPayouts, setRecentPayouts] = useState<Payout[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [allPayouts, setAllPayouts] = useState<Payout[]>([]);
  const [earningsSummary, setEarningsSummary] = useState({ total_earned: 0, total_paid: 0, outstanding: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/customer/affiliate/dashboard');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Failed to load');
      setIsAffiliate(j.is_affiliate ?? false);
      setPartner(j.partner ?? null);
      setThisMonth(j.this_month ?? { clicks: 0, conversions: 0, earned: 0 });
      setPendingPayout(j.pending_payout ?? 0);
      setRecentLinks(j.recent_links ?? []);
      setRecentPayouts(j.recent_payouts ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMaterials = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/affiliate-materials');
      const j = await r.json();
      setMaterials(j.materials ?? []);
    } catch {}
  }, []);

  const loadEarnings = useCallback(async () => {
    try {
      const r = await fetch('/api/customer/affiliate/earnings');
      const j = await r.json();
      setEarnings(j.earnings ?? []);
      setEarningsSummary({ total_earned: j.total_earned ?? 0, total_paid: j.total_paid ?? 0, outstanding: j.outstanding ?? 0 });
    } catch {}
  }, []);

  useEffect(() => {
    loadDashboard();
    loadMaterials();
    loadEarnings();
  }, [loadDashboard, loadMaterials, loadEarnings]);

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  }

  async function submitApplication(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const fd = new FormData(e.currentTarget);
      const r = await fetch('/api/customer/affiliate/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          email: fd.get('email'),
          website: fd.get('website') || null,
          niche: fd.get('niche') || null,
          audience_size: Number(fd.get('audience_size')) || 0,
          application_notes: fd.get('notes') || null,
          social_handles: {
            instagram: fd.get('instagram') || null,
            youtube: fd.get('youtube') || null,
            blog: fd.get('blog') || null,
          },
        }),
      });
      const j = await r.json();
      if (!r.ok && !j.already_exists) throw new Error(j.error ?? 'Application failed');
      setSuccess(j.message ?? 'Application submitted successfully.');
      await loadDashboard();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  // ── Tab content ────────────────────────────────────────────────────────────

  function renderDashboard() {
    if (!isAffiliate) {
      return (
        <div className="bg-slate-800/70 border border-white/20 rounded-xl border p-8 text-center max-w-lg mx-auto">
          <div className="text-4xl mb-4">🤝</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Join the Affiliate Program</h2>
          <p className="text-gray-600 mb-6">Earn commissions by sharing SohamYoga with your audience. Apply today and start earning when your followers sign up.</p>
          <div className="grid grid-cols-3 gap-4 mb-6 text-center">
            <div><p className="text-2xl font-bold text-blue-700">10-20%</p><p className="text-xs text-white/60">Commission Rate</p></div>
            <div><p className="text-2xl font-bold text-blue-700">30 days</p><p className="text-xs text-white/60">Cookie Window</p></div>
            <div><p className="text-2xl font-bold text-blue-700">Monthly</p><p className="text-xs text-white/60">Payouts</p></div>
          </div>
          <button onClick={() => setTab('apply')} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">Apply Now</button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Welcome banner */}
        <div className={`rounded-xl p-5 ${TIER_COLORS[partner?.tier ?? 'bronze'] ?? 'bg-gray-100'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Welcome back, {partner?.name}!</h2>
              <p className="text-sm opacity-75">
                {partner?.status === 'approved' ? `You are an approved affiliate partner at ${partner?.tier} tier.` : `Your application status: ${partner?.status}.`}
              </p>
            </div>
            <div className="text-right">
              <Badge label={partner?.tier ?? 'bronze'} colorClass="bg-white text-gray-800 border" />
              {partner?.status !== 'approved' && (
                <p className="text-xs mt-1 opacity-75">Links inactive until approved</p>
              )}
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Clicks This Month" value={thisMonth.clicks.toLocaleString()} />
          <KpiCard label="Conversions This Month" value={thisMonth.conversions.toLocaleString()} />
          <KpiCard label="Earned This Month" value={fmtMoney(thisMonth.earned)} />
          <KpiCard label="Pending Payout" value={fmtMoney(pendingPayout)} sub="available to withdraw" />
        </div>

        {/* Quick share links */}
        {recentLinks.length > 0 && (
          <div className="bg-slate-800/70 border border-white/20 rounded-xl border p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Your Top Links</h2>
            <div className="space-y-2">
              {recentLinks.slice(0, 3).map(link => {
                const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${link.code}`;
                return (
                  <div key={link.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <code className="text-sm font-mono flex-1 truncate">{url}</code>
                    <button
                      onClick={() => copyToClipboard(url, link.id)}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 whitespace-nowrap"
                    >
                      {copied === link.id ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent payouts */}
        {recentPayouts.length > 0 && (
          <div className="bg-slate-800/70 border border-white/20 rounded-xl border p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Recent Payouts</h2>
            <div className="space-y-2">
              {recentPayouts.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{p.period}</p>
                    <p className="text-xs text-white/40">{p.payment_method ?? 'Pending payment method'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{fmtMoney(p.amount)}</p>
                    <Badge label={p.status} colorClass={PAYOUT_STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderMyLinks() {
    if (!isAffiliate || partner?.status !== 'approved') {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-yellow-800 font-medium">Your affiliate account must be approved before you can access tracking links.</p>
          {!isAffiliate && <button onClick={() => setTab('apply')} className="mt-3 px-4 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700">Apply Now</button>}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white/90">My Tracking Links</h2>
          <p className="text-sm text-white/60">{recentLinks.length} link(s)</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <p><strong>Your commission rate:</strong> {partner?.commission_rate_bps ? `${(partner.commission_rate_bps / 100).toFixed(1)}%` : '—'} | <strong>Cookie window:</strong> 30 days | <strong>Tier:</strong> <span className="capitalize">{partner?.tier}</span></p>
        </div>

        {recentLinks.length === 0 && (
          <div className="bg-slate-800/70 border border-white/20 rounded-xl border p-8 text-center text-white/60">
            <p>No tracking links yet. Your admin will set up tracking links for you, or contact support to generate one.</p>
          </div>
        )}

        <div className="space-y-3">
          {recentLinks.map(link => {
            const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${link.code}`;
            const utmUrl = `${url}?utm_source=affiliate&utm_medium=link&utm_campaign=${link.code}`;
            return (
              <div key={link.id} className="bg-slate-800/70 border border-white/20 rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-white">Referral Code: <code className="text-blue-600">{link.code}</code></p>
                  <p className="text-xs text-white/40">{new Date(link.created_at).toLocaleDateString()}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="text" readOnly value={url} className="flex-1 border rounded-lg px-3 py-2 text-sm bg-gray-50 font-mono" />
                    <button onClick={() => copyToClipboard(url, link.id)} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 whitespace-nowrap">{copied === link.id ? 'Copied!' : 'Copy Link'}</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="text" readOnly value={utmUrl} className="flex-1 border rounded-lg px-3 py-2 text-xs bg-gray-50 font-mono" />
                    <button onClick={() => copyToClipboard(utmUrl, `utm-${link.id}`)} className="px-3 py-2 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 whitespace-nowrap">{copied === `utm-${link.id}` ? 'Copied!' : 'Copy UTM'}</button>
                  </div>
                </div>
                {link.qr_code_url && (
                  <div className="flex items-center gap-3">
                    <img src={link.qr_code_url} alt="QR Code" className="w-20 h-20 border rounded" />
                    <div>
                      <p className="text-sm font-medium">QR Code</p>
                      <a href={link.qr_code_url} download={`qr-${link.code}.png`} className="text-xs text-blue-600 hover:underline">Download PNG</a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderMaterials() {
    if (!isAffiliate || partner?.status !== 'approved') {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-yellow-800 font-medium">Marketing materials are only available to approved affiliate partners.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white/90">Marketing Materials</h2>
        <p className="text-sm text-white/60">Download or copy these materials to promote SohamYoga with your audience.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map(m => (
            <div key={m.id} className="bg-slate-800/70 border border-white/20 rounded-xl border p-4 space-y-3">
              <div>
                <p className="font-medium text-gray-900 text-sm">{m.title}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge label={m.type.replace('_', ' ')} colorClass="bg-blue-50 text-blue-700" />
                  {m.format && <Badge label={m.format} colorClass="bg-gray-100 text-white/70" />}
                  {m.platform && <Badge label={m.platform} colorClass="bg-purple-50 text-purple-700" />}
                </div>
              </div>
              {m.copy_text && (
                <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 max-h-24 overflow-y-auto">{m.copy_text.substring(0, 200)}{m.copy_text.length > 200 ? '...' : ''}</div>
              )}
              {m.cta_text && <p className="text-xs font-medium text-green-700">CTA: {m.cta_text}</p>}
              {m.utm_preset && (
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-gray-100 px-1.5 py-1 rounded flex-1 truncate">{m.utm_preset}</code>
                  <button onClick={() => copyToClipboard(m.utm_preset ?? '', `utm-mat-${m.id}`)} className="text-xs text-blue-600 hover:underline whitespace-nowrap">{copied === `utm-mat-${m.id}` ? 'Copied!' : 'Copy'}</button>
                </div>
              )}
              <div className="flex gap-2">
                {m.copy_text && (
                  <button
                    onClick={async () => {
                      await copyToClipboard(m.copy_text ?? '', `copy-${m.id}`);
                      fetch('/api/admin/affiliate-materials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'download', id: m.id }) });
                    }}
                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >{copied === `copy-${m.id}` ? 'Copied!' : 'Copy Text'}</button>
                )}
                {m.file_url && (
                  <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">Download</a>
                )}
              </div>
            </div>
          ))}
          {!materials.length && <p className="text-gray-400 col-span-3">No materials available yet.</p>}
        </div>
      </div>
    );
  }

  function renderEarnings() {
    if (!isAffiliate) return <div className="bg-white/5 rounded-xl p-6 text-center text-white/60">Not an affiliate partner yet. <button onClick={() => setTab('apply')} className="text-blue-600 hover:underline">Apply now</button></div>;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard label="Total Earned" value={fmtMoney(earningsSummary.total_earned)} />
          <KpiCard label="Total Paid" value={fmtMoney(earningsSummary.total_paid)} />
          <KpiCard label="Outstanding Balance" value={fmtMoney(earningsSummary.outstanding)} sub="available for payout" />
        </div>
        <div className="bg-slate-800/70 border border-white/20 rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b"><tr>{['Date', 'Order', 'Earned', 'Reversed', 'Paid', 'Balance'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-white/60">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {earnings.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm">{new Date(e.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-sm font-mono">{e.order_number ?? e.order_id.substring(0, 8)}</td>
                  <td className="px-3 py-2 font-medium text-green-700">{fmtMoney(e.earned)}</td>
                  <td className="px-3 py-2 text-red-600">{Number(e.reversed) > 0 ? fmtMoney(e.reversed) : '—'}</td>
                  <td className="px-3 py-2">{Number(e.paid) > 0 ? fmtMoney(e.paid) : '—'}</td>
                  <td className="px-3 py-2 font-medium">{fmtMoney(Number(e.earned) - Number(e.reversed) - Number(e.paid))}</td>
                </tr>
              ))}
              {!earnings.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-white/40">No earnings yet. Share your tracking links to start earning!</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderPayouts() {
    if (!isAffiliate) return <div className="bg-white/5 rounded-xl p-6 text-center text-white/60">Not an affiliate partner yet.</div>;

    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white/90">Payout History</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          Payouts are processed monthly for balances over $10. You will receive payment via the method on file with the admin team.
        </div>
        <div className="bg-slate-800/70 border border-white/20 rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b"><tr>{['Period', 'Amount', 'Status', 'Method', 'Reference', 'Paid At'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-medium text-white/60">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {allPayouts.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{p.period}</td>
                  <td className="px-3 py-2 font-semibold">{fmtMoney(p.amount)}</td>
                  <td className="px-3 py-2"><Badge label={p.status} colorClass={PAYOUT_STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'} /></td>
                  <td className="px-3 py-2 text-sm capitalize">{p.payment_method?.replace('_', ' ') ?? '—'}</td>
                  <td className="px-3 py-2 text-xs font-mono">{p.payment_reference ?? '—'}</td>
                  <td className="px-3 py-2 text-sm">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {!allPayouts.length && recentPayouts.length > 0 && recentPayouts.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{p.period}</td>
                  <td className="px-3 py-2 font-semibold">{fmtMoney(p.amount)}</td>
                  <td className="px-3 py-2"><Badge label={p.status} colorClass={PAYOUT_STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'} /></td>
                  <td className="px-3 py-2 text-sm capitalize">{p.payment_method?.replace('_', ' ') ?? '—'}</td>
                  <td className="px-3 py-2 text-xs font-mono">{p.payment_reference ?? '—'}</td>
                  <td className="px-3 py-2 text-sm">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {!allPayouts.length && !recentPayouts.length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-white/40">No payouts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderApply() {
    if (isAffiliate && partner) {
      return (
        <div className="bg-slate-800/70 border border-white/20 rounded-xl border p-8 max-w-lg mx-auto text-center">
          <div className="text-4xl mb-4">
            {partner.status === 'approved' ? '✅' : partner.status === 'pending' ? '⏳' : partner.status === 'rejected' ? '❌' : '⚠️'}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {partner.status === 'approved' ? 'You are an Approved Affiliate Partner!' : `Application Status: ${partner.status.charAt(0).toUpperCase() + partner.status.slice(1)}`}
          </h2>
          <p className="text-gray-600 mb-4">
            {partner.status === 'approved' && 'Your account is active. Use the Dashboard and My Links tabs to start promoting.'}
            {partner.status === 'pending' && 'Your application is under review. We will respond within 2 business days.'}
            {partner.status === 'rejected' && 'Your application was not approved at this time. You may contact support for more information.'}
            {partner.status === 'suspended' && 'Your account has been suspended. Please contact support.'}
          </p>
          <div className="text-sm text-white/60">
            <p>Tier: <span className="capitalize font-medium">{partner.tier}</span></p>
            <p>Commission: <strong>{(partner.commission_rate_bps / 100).toFixed(1)}%</strong></p>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-slate-800/70 border border-white/20 rounded-xl border p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Apply to the Affiliate Program</h2>
          <p className="text-gray-600 text-sm mb-6">Join our affiliate program and earn commissions for every customer you refer. We review applications within 2 business days.</p>

          <div className="grid grid-cols-3 gap-4 mb-6 text-center bg-blue-50 rounded-xl p-4">
            <div><p className="text-xl font-bold text-blue-700">10-20%</p><p className="text-xs text-white/70">Commission</p></div>
            <div><p className="text-xl font-bold text-blue-700">30 days</p><p className="text-xs text-white/70">Cookie Window</p></div>
            <div><p className="text-xl font-bold text-blue-700">Monthly</p><p className="text-xs text-white/70">Payouts</p></div>
          </div>

          <form onSubmit={submitApplication} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input name="name" type="text" placeholder="Your name or blog name" required className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
              <input name="email" type="email" placeholder="your@email.com" required className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website / Blog URL</label>
              <input name="website" type="url" placeholder="https://yourblog.com" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Niche / Topic</label>
              <select name="niche" className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select your primary niche</option>
                <option value="yoga">Yoga</option>
                <option value="fitness">Fitness</option>
                <option value="wellness">Wellness</option>
                <option value="mindfulness">Mindfulness</option>
                <option value="nutrition">Nutrition</option>
                <option value="lifestyle">Lifestyle</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Audience Size</label>
              <input name="audience_size" type="number" min="0" placeholder="e.g. 5000" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Social Handles (optional)</label>
              <div className="space-y-2">
                <input name="instagram" type="text" placeholder="@instagram_handle" className="w-full border rounded-lg px-3 py-2 text-sm" />
                <input name="youtube" type="url" placeholder="YouTube channel URL" className="w-full border rounded-lg px-3 py-2 text-sm" />
                <input name="blog" type="url" placeholder="Blog URL" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Why do you want to join? (optional)</label>
              <textarea name="notes" rows={3} placeholder="Tell us a little about your audience and how you plan to promote SohamYoga..." className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <button type="submit" disabled={busy} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {busy ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Affiliate Program</h1>
        <p className="text-gray-500 text-sm mt-1">Earn commissions by sharing SohamYoga with your audience.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm">{success}</div>}

      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === t ? 'bg-white border border-b-white -mb-px text-blue-700 border-gray-200' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>{t.replace('-', ' ')}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === 'dashboard' && renderDashboard()}
          {tab === 'my-links' && renderMyLinks()}
          {tab === 'materials' && renderMaterials()}
          {tab === 'earnings' && renderEarnings()}
          {tab === 'payouts' && renderPayouts()}
          {tab === 'apply' && renderApply()}
        </>
      )}
    </div>
  );
}
