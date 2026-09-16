'use client';
import { useEffect, useState, useCallback } from 'react';

// ─── Canadian Financial Providers ────────────────────────────────────────────
const INSTITUTIONS = {
  banks: ['RBC', 'TD', 'BMO', 'Scotiabank', 'CIBC', 'National Bank', 'ATB Financial', 'EQ Bank', 'Oaken Financial'],
  investment: ['Manulife Investments', 'Sun Life Global Investments', 'Fidelity Canada', 'iShares BlackRock', 'Vanguard Canada', 'CI Financial', 'Mackenzie Investments', 'AGF', 'Dynamic Funds', 'IG Wealth'],
  robo: ['Wealthsimple', 'Questrade', 'Questwealth', 'CI Direct Investing', 'Nest Wealth', 'ModernAdvisor'],
  resp: ['CST (Canadian Scholarship Trust)', 'Heritage RESP', 'Universitas'],
  annuities: ['Sun Life', 'Manulife', 'Canada Life', 'Equitable Life', 'iA Financial', 'Empire Life'],
};
const ALL_INSTITUTIONS = [...new Set([...INSTITUTIONS.banks, ...INSTITUTIONS.investment, ...INSTITUTIONS.robo, ...INSTITUTIONS.resp, ...INSTITUTIONS.annuities])];
const ACCOUNT_TYPES = ['RRSP', 'TFSA', 'RESP', 'RRIF', 'LIRA', 'LIF', 'FHSA', 'non_registered', 'corporate'];

// ─── Types ────────────────────────────────────────────────────────────────────
type FAStats = {
  aum: { total_aum: string; avg_account_value: string; total_accounts: string; clients_with_accounts: string };
  clients: { total: string; active: string; kyc_done: string; avg_investable_assets: string };
  accounts_by_type: { account_type: string; count: string; total_value: string }[];
  risk_distribution: { risk_tolerance: string; count: string }[];
  recommendations: { status: string; count: string }[];
};

type FAClient = {
  id: number; name: string; email: string | null; phone: string | null;
  province: string; employment_status: string | null;
  annual_income: string | null; net_worth: string | null; investable_assets: string | null;
  risk_tolerance: string; investment_horizon: string | null; primary_goal: string | null;
  retirement_age_target: number | null; tax_bracket: string | null;
  rrsp_room: string | null; tfsa_room: string | null; fhsa_eligible: boolean;
  status: string; kyc_completed: boolean; kyc_date: string | null;
  advisor_notes: string | null; created_at: string;
  account_count?: string; total_portfolio_value?: string;
};

type FAAccount = {
  id: number; client_id: number; client_name?: string; account_type: string;
  institution: string; account_number: string | null;
  current_value: string; book_value: string; unrealized_gain: string;
  annual_contribution: string | null; currency: string; status: string;
  opened_date: string | null; created_at: string;
  holdings?: FAHolding[] | null;
};

type FAHolding = {
  id: number; account_id: number; ticker: string | null; fund_name: string;
  asset_class: string | null; geography: string | null;
  quantity: string | null; avg_cost: string | null; current_price: string | null;
  market_value: string | null; weight_pct: string | null;
  asset_type: string | null; provider: string | null; mer_pct: string | null;
};

type FARecommendation = {
  id: number; client_id: number; client_name: string;
  recommendation_type: string | null; description: string;
  products: unknown[]; estimated_impact: string | null;
  priority: string; status: string; created_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = ['dashboard', 'clients', 'portfolios', 'recommendations', 'ai-planning', 'compliance'] as const;
type Tab = typeof TABS[number];

const RISK_COLORS: Record<string, string> = {
  conservative: 'bg-blue-100 text-blue-700',
  moderate: 'bg-green-100 text-green-700',
  balanced: 'bg-teal-100 text-teal-700',
  growth: 'bg-orange-100 text-orange-700',
  aggressive: 'bg-red-100 text-red-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const REC_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  presented: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
};

function fmt$(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  if (isNaN(n)) return '$0';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
function fmt$2(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  return isNaN(n) ? '$0.00' : `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>{label}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FinancialAdvisorPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<FAStats | null>(null);
  const [clients, setClients] = useState<FAClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<FAClient | null>(null);
  const [clientAccounts, setClientAccounts] = useState<FAAccount[]>([]);
  const [recommendations, setRecommendations] = useState<FARecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddHolding, setShowAddHolding] = useState<FAAccount | null>(null);
  const [showAddRec, setShowAddRec] = useState(false);

  const [aiClient, setAiClient] = useState('');
  const [financialPlan, setFinancialPlan] = useState('');
  const [rebalanceAdvice, setRebalanceAdvice] = useState('');
  const [taxTips, setTaxTips] = useState('');
  const [aiLoading, setAiLoading] = useState<'plan' | 'rebalance' | 'tax' | null>(null);

  const [recStatusFilter, setRecStatusFilter] = useState('');

  const [newClient, setNewClient] = useState({
    name: '', email: '', phone: '', province: 'AB', employment_status: 'employed',
    annual_income: '', net_worth: '', investable_assets: '',
    risk_tolerance: 'moderate', investment_horizon: 'long_term(7y+)',
    primary_goal: 'retirement', retirement_age_target: '65',
    tax_bracket: '33', rrsp_room: '', tfsa_room: '',
    fhsa_eligible: false, status: 'prospect', advisor_notes: '',
  });

  const [newAccount, setNewAccount] = useState({
    client_id: '', account_type: 'RRSP', institution: '', account_number: '',
    current_value: '', book_value: '', annual_contribution: '', opened_date: '',
  });

  const [newHolding, setNewHolding] = useState({
    ticker: '', fund_name: '', asset_class: 'equities', geography: 'canada',
    quantity: '', avg_cost: '', current_price: '', market_value: '',
    asset_type: 'etf', provider: '', mer_pct: '',
  });

  const [newRec, setNewRec] = useState({
    client_id: '', recommendation_type: 'rebalance', description: '', estimated_impact: '', priority: 'medium',
  });

  const loadStats = useCallback(async () => {
    const r = await fetch('/api/admin/financial-advisor/stats');
    if (r.ok) setStats(await r.json());
  }, []);

  const loadClients = useCallback(async () => {
    const r = await fetch('/api/admin/financial-advisor/clients');
    if (r.ok) { const d = await r.json(); setClients(d.clients); }
  }, []);

  const loadRecommendations = useCallback(async () => {
    const params = recStatusFilter ? `?status=${recStatusFilter}` : '';
    const r = await fetch(`/api/admin/financial-advisor/recommendations${params}`);
    if (r.ok) { const d = await r.json(); setRecommendations(d.recommendations); }
  }, [recStatusFilter]);

  const loadClientDetail = useCallback(async (clientId: number) => {
    const r = await fetch(`/api/admin/financial-advisor/clients/${clientId}`);
    if (r.ok) { const d = await r.json(); setSelectedClient(d.client); setClientAccounts(d.accounts); }
  }, []);

  useEffect(() => { loadStats(); loadClients(); }, [loadStats, loadClients]);
  useEffect(() => { if (tab === 'recommendations') loadRecommendations(); }, [tab, loadRecommendations]);

  const saveClient = async () => {
    if (!newClient.name.trim()) { setError('Name required'); return; }
    setLoading(true);
    const r = await fetch('/api/admin/financial-advisor/clients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newClient),
    });
    setLoading(false);
    if (r.ok) {
      setShowAddClient(false);
      setNewClient({ name: '', email: '', phone: '', province: 'AB', employment_status: 'employed', annual_income: '', net_worth: '', investable_assets: '', risk_tolerance: 'moderate', investment_horizon: 'long_term(7y+)', primary_goal: 'retirement', retirement_age_target: '65', tax_bracket: '33', rrsp_room: '', tfsa_room: '', fhsa_eligible: false, status: 'prospect', advisor_notes: '' });
      loadClients(); loadStats();
    } else { const d = await r.json(); setError(d.error || 'Failed'); }
  };

  const saveAccount = async () => {
    if (!newAccount.client_id || !newAccount.account_type || !newAccount.institution) { setError('Client, account type, institution required'); return; }
    setLoading(true);
    const r = await fetch('/api/admin/financial-advisor/accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAccount),
    });
    setLoading(false);
    if (r.ok) {
      setShowAddAccount(false);
      setNewAccount({ client_id: '', account_type: 'RRSP', institution: '', account_number: '', current_value: '', book_value: '', annual_contribution: '', opened_date: '' });
      if (selectedClient) loadClientDetail(selectedClient.id); loadStats();
    } else { const d = await r.json(); setError(d.error || 'Failed'); }
  };

  const saveHolding = async (accountId: number) => {
    if (!newHolding.fund_name) { setError('Fund name required'); return; }
    setLoading(true);
    const r = await fetch(`/api/admin/financial-advisor/accounts/${accountId}/holdings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newHolding),
    });
    setLoading(false);
    if (r.ok) {
      setShowAddHolding(null);
      setNewHolding({ ticker: '', fund_name: '', asset_class: 'equities', geography: 'canada', quantity: '', avg_cost: '', current_price: '', market_value: '', asset_type: 'etf', provider: '', mer_pct: '' });
      if (selectedClient) loadClientDetail(selectedClient.id); loadStats();
    } else { const d = await r.json(); setError(d.error || 'Failed'); }
  };

  const saveRec = async () => {
    if (!newRec.client_id || !newRec.description) { setError('Client and description required'); return; }
    setLoading(true);
    const r = await fetch('/api/admin/financial-advisor/recommendations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRec),
    });
    setLoading(false);
    if (r.ok) {
      setShowAddRec(false);
      setNewRec({ client_id: '', recommendation_type: 'rebalance', description: '', estimated_impact: '', priority: 'medium' });
      loadRecommendations();
    } else { const d = await r.json(); setError(d.error || 'Failed'); }
  };

  const updateRecStatus = async (id: number, action: 'accept' | 'decline') => {
    const r = await fetch(`/api/admin/financial-advisor/recommendations/${id}?action=${action}`, { method: 'POST' });
    if (r.ok) loadRecommendations();
  };

  const runAI = async (type: 'plan' | 'rebalance' | 'tax') => {
    if (!aiClient) { setError('Select a client first'); return; }
    setAiLoading(type);
    const endpoint = type === 'plan' ? 'financial-plan' : type === 'rebalance' ? 'rebalance-advice' : 'tax-optimizer';
    const r = await fetch(`/api/admin/financial-advisor/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: Number(aiClient) }),
    });
    if (r.ok) {
      const d = await r.json();
      if (type === 'plan') setFinancialPlan(d.plan);
      else if (type === 'rebalance') setRebalanceAdvice(d.advice);
      else setTaxTips(d.tips);
    }
    setAiLoading(null);
  };

  const totalAUM = Number(stats?.aum?.total_aum ?? 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">Financial Advisor Portal</h1>
          <p className="text-slate-300 text-sm mt-1">Canadian Investment Management — RRSP · TFSA · RESP · FHSA · Seg Funds · ETFs</p>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); }}
              className={`px-4 py-3 text-sm font-medium capitalize whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-slate-700 text-slate-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.replace(/-/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm flex justify-between">
            {error}<button onClick={() => setError('')} className="font-bold">x</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">

        {tab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total AUM', value: fmt$(totalAUM), sub: `${stats?.aum?.total_accounts ?? 0} accounts` },
                { label: 'Total Clients', value: stats?.clients?.total ?? '0', sub: `${stats?.clients?.kyc_done ?? 0} KYC complete` },
                { label: 'Avg Portfolio', value: fmt$(stats?.aum?.avg_account_value), sub: 'per account' },
                { label: 'Avg Investable Assets', value: fmt$(stats?.clients?.avg_investable_assets), sub: 'per client' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</div>
                  <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
                  <div className="text-xs text-gray-400 mt-1">{sub}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-slate-700 mb-3">Assets by Account Type</h2>
                {(stats?.accounts_by_type ?? []).map(({ account_type, total_value }) => {
                  const pct = totalAUM > 0 ? (Number(total_value) / totalAUM * 100) : 0;
                  return (
                    <div key={account_type} className="flex items-center gap-3 mb-2">
                      <div className="w-20 text-sm text-gray-600 font-medium">{account_type}</div>
                      <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
                        <div className="h-4 bg-slate-600 rounded" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <div className="w-16 text-xs text-gray-600 text-right">{fmt$(total_value)}</div>
                    </div>
                  );
                })}
                {(!stats?.accounts_by_type?.length) && <p className="text-gray-400 text-sm">No accounts yet</p>}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-slate-700 mb-3">Clients by Risk Tolerance</h2>
                {(stats?.risk_distribution ?? []).map(({ risk_tolerance, count }) => (
                  <div key={risk_tolerance} className="flex items-center gap-3 mb-2">
                    <div className="w-28"><Badge label={risk_tolerance} colorClass={RISK_COLORS[risk_tolerance] ?? 'bg-gray-100 text-gray-600'} /></div>
                    <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
                      <div className="h-4 bg-slate-500 rounded" style={{ width: `${Math.min(100, Number(count) * 15)}%` }} />
                    </div>
                    <div className="w-6 text-sm font-semibold text-gray-700 text-right">{count}</div>
                  </div>
                ))}
                {(!stats?.risk_distribution?.length) && <p className="text-gray-400 text-sm">No clients yet</p>}
              </div>
            </div>
          </div>
        )}

        {tab === 'clients' && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={() => setShowAddClient(true)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium">+ Add Client</button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>
                  {['Name','Province','Income','Portfolio','Risk','Goal','KYC','Status','Accounts'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedClient(c); setNewAccount(p => ({ ...p, client_id: String(c.id) })); }}>
                      <td className="px-4 py-3"><div className="font-medium text-slate-800">{c.name}</div><div className="text-xs text-gray-400">{c.email}</div></td>
                      <td className="px-4 py-3 text-gray-600">{c.province}</td>
                      <td className="px-4 py-3">{c.annual_income ? fmt$(c.annual_income) : '—'}</td>
                      <td className="px-4 py-3 font-medium">{c.total_portfolio_value ? fmt$(c.total_portfolio_value) : '—'}</td>
                      <td className="px-4 py-3"><Badge label={c.risk_tolerance} colorClass={RISK_COLORS[c.risk_tolerance] ?? 'bg-gray-100 text-gray-600'} /></td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{c.primary_goal?.replace(/_/g,' ') ?? '—'}</td>
                      <td className="px-4 py-3">{c.kyc_completed ? <Badge label="Done" colorClass="bg-green-100 text-green-700" /> : <Badge label="Pending" colorClass="bg-yellow-100 text-yellow-700" />}</td>
                      <td className="px-4 py-3"><Badge label={c.status} colorClass="bg-gray-100 text-gray-600" /></td>
                      <td className="px-4 py-3 text-center">{c.account_count ?? '0'}</td>
                    </tr>
                  ))}
                  {clients.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No clients yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'portfolios' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <select value={selectedClient?.id ?? ''} onChange={e => {
                const id = Number(e.target.value);
                const c = clients.find(x => x.id === id);
                setSelectedClient(c ?? null);
                setClientAccounts([]);
                if (id) loadClientDetail(id);
              }} className="border border-gray-300 rounded px-3 py-2 text-sm min-w-52">
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {selectedClient && (
                <button onClick={() => { setNewAccount(p => ({ ...p, client_id: String(selectedClient.id) })); setShowAddAccount(true); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm">+ Add Account</button>
              )}
            </div>

            {selectedClient && (
              <>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="font-semibold text-slate-800">{selectedClient.name}</h2>
                      <p className="text-sm text-gray-500">{selectedClient.risk_tolerance} risk · {selectedClient.primary_goal?.replace(/_/g,' ')} · {selectedClient.investment_horizon}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-slate-800">{fmt$2(clientAccounts.reduce((s, a) => s + Number(a.current_value), 0))}</div>
                      <div className="text-xs text-gray-400">Total Portfolio</div>
                    </div>
                  </div>
                </div>

                {clientAccounts.map(account => {
                  const gain = Number(account.unrealized_gain);
                  return (
                    <div key={account.id} className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <span className="font-semibold text-slate-700">{account.account_type}</span>
                          <span className="text-gray-400 text-sm ml-2">@ {account.institution}</span>
                          {account.account_number && <span className="text-gray-300 text-xs ml-2">#{account.account_number}</span>}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-800">{fmt$2(account.current_value)}</div>
                          <div className={`text-xs ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {gain >= 0 ? '+' : ''}{fmt$2(account.unrealized_gain)} unrealized
                          </div>
                        </div>
                      </div>
                      {account.holdings && account.holdings.length > 0 ? (
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50"><tr>
                            {['Fund','Ticker','Class','Geography','Qty','Avg Cost','Price','Market Value','Weight','MER'].map(h =>
                              <th key={h} className="px-2 py-1.5 text-left text-gray-500">{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {account.holdings.map(h => (
                              <tr key={h.id} className="border-b">
                                <td className="px-2 py-1.5 font-medium">{h.fund_name}</td>
                                <td className="px-2 py-1.5 text-gray-400">{h.ticker ?? '—'}</td>
                                <td className="px-2 py-1.5">{h.asset_class ?? '—'}</td>
                                <td className="px-2 py-1.5">{h.geography ?? '—'}</td>
                                <td className="px-2 py-1.5">{h.quantity ?? '—'}</td>
                                <td className="px-2 py-1.5">{h.avg_cost ? `$${Number(h.avg_cost).toFixed(2)}` : '—'}</td>
                                <td className="px-2 py-1.5">{h.current_price ? `$${Number(h.current_price).toFixed(2)}` : '—'}</td>
                                <td className="px-2 py-1.5 font-semibold">{h.market_value ? fmt$2(h.market_value) : '—'}</td>
                                <td className="px-2 py-1.5">{h.weight_pct ? `${Number(h.weight_pct).toFixed(1)}%` : '—'}</td>
                                <td className={`px-2 py-1.5 ${Number(h.mer_pct) > 2 ? 'text-red-600 font-semibold' : ''}`}>{h.mer_pct ? `${Number(h.mer_pct).toFixed(2)}%` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : <p className="text-xs text-gray-400">No holdings recorded</p>}
                      <button onClick={() => setShowAddHolding(account)} className="mt-3 px-3 py-1.5 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50">+ Add Holding</button>
                    </div>
                  );
                })}
                {clientAccounts.length === 0 && <p className="text-gray-400 text-sm py-4">No accounts for this client — add one above.</p>}
              </>
            )}
          </div>
        )}

        {tab === 'recommendations' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <select value={recStatusFilter} onChange={e => setRecStatusFilter(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="">All Statuses</option>
                {['pending','presented','accepted','declined'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={loadRecommendations} className="px-4 py-2 bg-slate-700 text-white rounded text-sm">Filter</button>
              <button onClick={() => setShowAddRec(true)} className="ml-auto px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium">+ Add Recommendation</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {recommendations.map(rec => (
                <div key={rec.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">{rec.client_name}</div>
                      <div className="text-xs text-gray-400">{rec.recommendation_type?.replace(/_/g,' ') ?? '—'}</div>
                    </div>
                    <Badge label={rec.priority} colorClass={PRIORITY_COLORS[rec.priority] ?? 'bg-gray-100 text-gray-600'} />
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{rec.description}</p>
                  {rec.estimated_impact && <div className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded mb-2">Impact: {rec.estimated_impact}</div>}
                  <div className="flex justify-between items-center">
                    <Badge label={rec.status} colorClass={REC_STATUS_COLORS[rec.status] ?? 'bg-gray-100 text-gray-600'} />
                    {rec.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => updateRecStatus(rec.id, 'accept')} className="px-2 py-1 bg-green-600 text-white rounded text-xs">Accept</button>
                        <button onClick={() => updateRecStatus(rec.id, 'decline')} className="px-2 py-1 bg-red-500 text-white rounded text-xs">Decline</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {recommendations.length === 0 && <div className="col-span-3 text-center py-12 text-gray-400">No recommendations yet</div>}
            </div>
          </div>
        )}

        {tab === 'ai-planning' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-slate-700 mb-3">AI Financial Planning — Powered by Ollama</h2>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Select Client</label>
                <select value={aiClient} onChange={e => { setAiClient(e.target.value); setFinancialPlan(''); setRebalanceAdvice(''); setTaxTips(''); }}
                  className="border border-gray-300 rounded px-3 py-2 text-sm min-w-64">
                  <option value="">— select client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.risk_tolerance}, {fmt$(c.investable_assets)})</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {([
                { key: 'plan' as const, label: 'Generate Financial Plan', desc: 'RRSP/TFSA/FHSA/RESP/retirement projection', color: 'bg-slate-700' },
                { key: 'rebalance' as const, label: 'Rebalance Advice', desc: 'Drift analysis vs target, buy/sell recommendations', color: 'bg-teal-700' },
                { key: 'tax' as const, label: 'Tax Optimizer', desc: 'RRSP vs TFSA, income splitting, CPP/OAS, FHSA, capital gains', color: 'bg-purple-700' },
              ]).map(({ key, label, desc, color }) => (
                <div key={key} className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-slate-700 mb-1">{label}</h3>
                  <p className="text-xs text-gray-500 mb-3">{desc}</p>
                  <button onClick={() => runAI(key)} disabled={!aiClient || aiLoading !== null}
                    className={`w-full py-2 ${color} text-white rounded text-sm font-medium disabled:opacity-50`}>
                    {aiLoading === key ? 'Generating...' : label.split(' ')[0] + ' ' + label.split(' ')[1]}
                  </button>
                </div>
              ))}
            </div>
            {financialPlan && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-slate-700 mb-3">Financial Plan</h2>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{financialPlan}</div>
              </div>
            )}
            {rebalanceAdvice && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-slate-700 mb-3">Rebalance Advice</h2>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{rebalanceAdvice}</div>
              </div>
            )}
            {taxTips && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-slate-700 mb-3">Tax Optimizer</h2>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{taxTips}</div>
              </div>
            )}
          </div>
        )}

        {tab === 'compliance' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-700">KYC and Suitability by Client</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr>
                  {['Client','KYC','KYC Date','Risk','Horizon','Goal','Tax Bracket','RRSP Room','TFSA Room','FHSA','Notes'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} className={`border-b ${!c.kyc_completed ? 'bg-yellow-50' : ''}`}>
                      <td className="px-3 py-3 font-medium text-slate-800 whitespace-nowrap">{c.name}</td>
                      <td className="px-3 py-3">{c.kyc_completed ? <Badge label="Complete" colorClass="bg-green-100 text-green-700" /> : <Badge label="Pending" colorClass="bg-yellow-100 text-yellow-700" />}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{c.kyc_date ? new Date(c.kyc_date).toLocaleDateString('en-CA') : '—'}</td>
                      <td className="px-3 py-3"><Badge label={c.risk_tolerance} colorClass={RISK_COLORS[c.risk_tolerance] ?? 'bg-gray-100 text-gray-600'} /></td>
                      <td className="px-3 py-3 text-gray-600 text-xs">{c.investment_horizon?.replace(/_/g,' ') ?? '—'}</td>
                      <td className="px-3 py-3 text-gray-600 text-xs">{c.primary_goal?.replace(/_/g,' ') ?? '—'}</td>
                      <td className="px-3 py-3 text-gray-600">{c.tax_bracket ? `${c.tax_bracket}%` : '—'}</td>
                      <td className="px-3 py-3">{c.rrsp_room ? fmt$(c.rrsp_room) : '—'}</td>
                      <td className="px-3 py-3">{c.tfsa_room ? fmt$(c.tfsa_room) : '—'}</td>
                      <td className="px-3 py-3">{c.fhsa_eligible ? <Badge label="Eligible" colorClass="bg-blue-100 text-blue-700" /> : '—'}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs max-w-48 truncate">{c.advisor_notes ?? '—'}</td>
                    </tr>
                  ))}
                  {clients.length === 0 && <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">No clients</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showAddClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-screen overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Add FA Client</h2>
              <button onClick={() => setShowAddClient(false)} className="text-gray-400 text-xl">x</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {([
                { label: 'Full Name *', key: 'name', type: 'text' },
                { label: 'Email', key: 'email', type: 'email' },
                { label: 'Phone', key: 'phone', type: 'tel' },
                { label: 'Annual Income ($)', key: 'annual_income', type: 'number' },
                { label: 'Net Worth ($)', key: 'net_worth', type: 'number' },
                { label: 'Investable Assets ($)', key: 'investable_assets', type: 'number' },
                { label: 'Retirement Age Target', key: 'retirement_age_target', type: 'number' },
                { label: 'RRSP Room ($)', key: 'rrsp_room', type: 'number' },
                { label: 'TFSA Room ($)', key: 'tfsa_room', type: 'number' },
              ] as { label: string; key: keyof typeof newClient; type: string }[]).map(({ label, key, type }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input type={type} value={String(newClient[key])} onChange={e => setNewClient(p => ({ ...p, [key]: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Province</label>
                <select value={newClient.province} onChange={e => setNewClient(p => ({ ...p, province: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['AB','BC','ON','QC','SK','MB','NS','NB','NL','PE','NT','NU','YT'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Risk Tolerance</label>
                <select value={newClient.risk_tolerance} onChange={e => setNewClient(p => ({ ...p, risk_tolerance: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['conservative','moderate','balanced','growth','aggressive'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Primary Goal</label>
                <select value={newClient.primary_goal} onChange={e => setNewClient(p => ({ ...p, primary_goal: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['retirement','education','home_purchase','wealth_building','income_generation','estate_planning'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Investment Horizon</label>
                <select value={newClient.investment_horizon} onChange={e => setNewClient(p => ({ ...p, investment_horizon: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['short_term(<3y)','medium_term(3-7y)','long_term(7y+)'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tax Bracket (%)</label>
                <select value={newClient.tax_bracket} onChange={e => setNewClient(p => ({ ...p, tax_bracket: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['20','26','33','43','53'].map(v => <option key={v} value={v}>{v}%</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-4">
                <input type="checkbox" id="fhsa_chk" checked={newClient.fhsa_eligible} onChange={e => setNewClient(p => ({ ...p, fhsa_eligible: e.target.checked }))} />
                <label htmlFor="fhsa_chk" className="text-sm text-gray-600">FHSA Eligible (first-time home buyer)</label>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Advisor Notes / Suitability</label>
                <textarea value={newClient.advisor_notes} onChange={e => setNewClient(p => ({ ...p, advisor_notes: e.target.value }))} rows={3} className="border border-gray-300 rounded px-3 py-2 text-sm w-full" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={saveClient} disabled={loading} className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Save Client'}</button>
              <button onClick={() => setShowAddClient(false)} className="px-5 py-2 border border-gray-300 rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAddAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Add Account</h2>
              <button onClick={() => setShowAddAccount(false)} className="text-gray-400 text-xl">x</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Client *</label>
                <select value={newAccount.client_id} onChange={e => setNewAccount(p => ({ ...p, client_id: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Account Type *</label>
                <select value={newAccount.account_type} onChange={e => setNewAccount(p => ({ ...p, account_type: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Institution *</label>
                <select value={newAccount.institution} onChange={e => setNewAccount(p => ({ ...p, institution: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  <option value="">Select...</option>
                  {ALL_INSTITUTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              {([
                { label: 'Account Number', key: 'account_number' },
                { label: 'Current Value ($)', key: 'current_value' },
                { label: 'Book Value ($)', key: 'book_value' },
                { label: 'Annual Contribution ($)', key: 'annual_contribution' },
              ] as { label: string; key: keyof typeof newAccount }[]).map(({ label, key }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input value={newAccount[key]} onChange={e => setNewAccount(p => ({ ...p, [key]: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Opened Date</label>
                <input type="date" value={newAccount.opened_date} onChange={e => setNewAccount(p => ({ ...p, opened_date: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={saveAccount} disabled={loading} className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Save Account'}</button>
              <button onClick={() => setShowAddAccount(false)} className="px-5 py-2 border border-gray-300 rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAddHolding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Add Holding — {showAddHolding.account_type} @ {showAddHolding.institution}</h2>
              <button onClick={() => setShowAddHolding(null)} className="text-gray-400 text-xl">x</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Fund Name *</label>
                <input value={newHolding.fund_name} onChange={e => setNewHolding(p => ({ ...p, fund_name: e.target.value }))} placeholder="e.g. Vanguard S&P 500 ETF" className="border border-gray-300 rounded px-3 py-2 text-sm w-full" />
              </div>
              {([
                { label: 'Ticker', key: 'ticker', placeholder: 'VFV' },
                { label: 'Provider', key: 'provider', placeholder: 'Vanguard Canada' },
                { label: 'Quantity', key: 'quantity', placeholder: '100' },
                { label: 'Avg Cost ($)', key: 'avg_cost', placeholder: '95.00' },
                { label: 'Current Price ($)', key: 'current_price', placeholder: '105.00' },
                { label: 'Market Value ($)', key: 'market_value', placeholder: 'auto from qty x price' },
                { label: 'MER (%)', key: 'mer_pct', placeholder: '0.09' },
                { label: 'Weight (%)', key: 'weight_pct', placeholder: '25' },
              ] as { label: string; key: keyof typeof newHolding; placeholder: string }[]).map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input value={newHolding[key]} onChange={e => setNewHolding(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} className="border border-gray-300 rounded px-3 py-2 text-sm w-full" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Asset Class</label>
                <select value={newHolding.asset_class} onChange={e => setNewHolding(p => ({ ...p, asset_class: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['equities','fixed_income','real_estate','commodities','cash','alternatives'].map(v => <option key={v} value={v}>{v.replace('_',' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Geography</label>
                <select value={newHolding.geography} onChange={e => setNewHolding(p => ({ ...p, geography: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['canada','us','international','global','emerging'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Asset Type</label>
                <select value={newHolding.asset_type} onChange={e => setNewHolding(p => ({ ...p, asset_type: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['etf','mutual_fund','stock','gic','bond','seg_fund','annuity'].map(v => <option key={v} value={v}>{v.replace('_',' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => saveHolding(showAddHolding.id)} disabled={loading} className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Save Holding'}</button>
              <button onClick={() => setShowAddHolding(null)} className="px-5 py-2 border border-gray-300 rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAddRec && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Add Recommendation</h2>
              <button onClick={() => setShowAddRec(false)} className="text-gray-400 text-xl">x</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Client *</label>
                <select value={newRec.client_id} onChange={e => setNewRec(p => ({ ...p, client_id: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Type</label>
                <select value={newRec.recommendation_type} onChange={e => setNewRec(p => ({ ...p, recommendation_type: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['rebalance','contribution','withdrawal','product_change','tax_optimization'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Description *</label>
                <textarea value={newRec.description} onChange={e => setNewRec(p => ({ ...p, description: e.target.value }))} rows={3} className="border border-gray-300 rounded px-3 py-2 text-sm w-full" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Estimated Impact</label>
                <input value={newRec.estimated_impact} onChange={e => setNewRec(p => ({ ...p, estimated_impact: e.target.value }))} placeholder="e.g. Save $3,000 in taxes annually" className="border border-gray-300 rounded px-3 py-2 text-sm w-full" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Priority</label>
                <select value={newRec.priority} onChange={e => setNewRec(p => ({ ...p, priority: e.target.value }))} className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
                  {['high','medium','low'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={saveRec} disabled={loading} className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50">{loading ? 'Saving...' : 'Save Recommendation'}</button>
              <button onClick={() => setShowAddRec(false)} className="px-5 py-2 border border-gray-300 rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
