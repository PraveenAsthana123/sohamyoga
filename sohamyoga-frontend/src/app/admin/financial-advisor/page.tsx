'use client';
import { useEffect, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const RISK_TOLERANCES = ['conservative', 'moderate', 'balanced', 'growth', 'aggressive'];
const INVESTMENT_HORIZONS = ['<1 year', '1-3 years', '3-5 years', '5-10 years', '10-20 years', '20+ years'];
const PRIMARY_GOALS = ['Retirement', 'Home Purchase', 'Education', 'Wealth Building', 'Income', 'Estate Planning', 'Emergency Fund', 'Travel'];
const ACCOUNT_TYPES = ['RRSP', 'TFSA', 'RESP', 'RRIF', 'FHSA', 'Non-Registered', 'Corporate', 'LIRA', 'LIF'];
const INSTITUTIONS = ['RBC', 'TD', 'BMO', 'Scotiabank', 'CIBC', 'National Bank', 'Questrade', 'Wealthsimple', 'Fidelity', 'CI Investments', 'Manulife', 'Sun Life', 'iA Financial', 'Other'];

const RISK_COLORS: Record<string, string> = {
  conservative: 'bg-blue-100 text-blue-800',
  moderate:     'bg-green-100 text-green-800',
  balanced:     'bg-teal-100 text-teal-800',
  growth:       'bg-orange-100 text-orange-800',
  aggressive:   'bg-red-100 text-red-800',
};

const TABS = ['dashboard', 'clients', 'portfolios', 'ai-planning', 'compliance'] as const;
type Tab = typeof TABS[number];

const fmt$ = (v: number) => '$' + Number(v).toLocaleString('en-CA', { maximumFractionDigits: 0 });
const fmt$dec = (v: number) => '$' + Number(v).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DashData {
  aum: { total_aum: number; client_count: number; avg_account_value: number };
  clients: { total: number };
  accounts_by_type: { account_type: string; count: number; total_value: number }[];
  contributions: { annual_contributions: number };
  risk_distribution: { risk_tolerance: string; count: number }[];
}

interface FAClient {
  id: number; name: string; email: string; phone: string;
  risk_tolerance: string; investable_assets: number; primary_goal: string;
  annual_income: number; investment_horizon: string;
  rrsp_room: number; tfsa_room: number; fhsa_eligible: boolean;
  kyc_completed: boolean; kyc_date: string; status: string;
  advisor_notes: string; created_at: string;
}

interface FAAccount {
  id: number; client_id: number; account_type: string; institution: string;
  account_number: string; current_value: number; book_value: number;
  unrealized_gain: number; annual_contribution: number; currency: string;
  status: string; opened_date: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function FinancialAdvisorPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dash, setDash] = useState<DashData | null>(null);
  const [clients, setClients] = useState<FAClient[]>([]);
  const [accounts, setAccounts] = useState<FAAccount[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modals
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);

  // AI Planning
  const [aiMode, setAiMode] = useState<'plan' | 'tax' | 'rebalance'>('plan');
  const [aiClientId, setAiClientId] = useState('');
  const [aiAllocation, setAiAllocation] = useState('moderate');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Forms
  const [clientForm, setClientForm] = useState({
    name: '', email: '', phone: '', date_of_birth: '', annual_income: '',
    investable_assets: '', risk_tolerance: 'moderate', investment_horizon: '5-10 years',
    primary_goal: 'Retirement', rrsp_room: '', tfsa_room: '', fhsa_eligible: false,
  });
  const [accountForm, setAccountForm] = useState({
    client_id: '', account_type: 'RRSP', institution: 'RBC',
    account_number: '', current_value: '', book_value: '', annual_contribution: '', opened_date: '',
  });

  const load = useCallback(async (t: Tab) => {
    setLoading(true); setError('');
    try {
      if (t === 'dashboard') {
        const r = await fetch('/api/admin/financial-advisor');
        if (!r.ok) throw new Error(await r.text());
        setDash(await r.json());
      } else if (t === 'clients' || t === 'compliance' || t === 'ai-planning') {
        const r = await fetch('/api/admin/financial-advisor/clients');
        if (!r.ok) throw new Error(await r.text());
        const d = await r.json() as { clients?: FAClient[] } | FAClient[];
        setClients(Array.isArray(d) ? d : (d.clients ?? []));
      }
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  const loadAccounts = useCallback(async (clientId: number) => {
    const r = await fetch(`/api/admin/financial-advisor/accounts?client_id=${clientId}`);
    if (!r.ok) return;
    const d = await r.json() as { accounts?: FAAccount[] } | FAAccount[];
    setAccounts(Array.isArray(d) ? d : (d.accounts ?? []));
  }, []);

  useEffect(() => {
    if (selectedClientId) loadAccounts(selectedClientId);
  }, [selectedClientId, loadAccounts]);

  // ---- Submit client ----
  const submitClient = async () => {
    const r = await fetch('/api/admin/financial-advisor/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientForm),
    });
    if (r.ok) { setShowAddClient(false); load('clients'); }
    else { alert(await r.text()); }
  };

  // ---- Submit account ----
  const submitAccount = async () => {
    const r = await fetch('/api/admin/financial-advisor/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...accountForm, client_id: accountForm.client_id || selectedClientId }),
    });
    if (r.ok) { setShowAddAccount(false); if (selectedClientId) loadAccounts(selectedClientId); }
    else { alert(await r.text()); }
  };

  // ---- Mark KYC complete ----
  const markKyc = async (clientId: number) => {
    const r = await fetch('/api/admin/financial-advisor', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: clientId, kyc_completed: true }),
    });
    if (r.ok) load('compliance');
    else { alert(await r.text()); }
  };

  // ---- AI planning ----
  const runAi = async () => {
    setAiLoading(true); setAiResult('');
    const client = clients.find(c => c.id === Number(aiClientId));
    if (!client && aiClientId) {
      setAiResult('Client not found.'); setAiLoading(false); return;
    }
    let prompt = '';
    if (aiMode === 'plan') {
      prompt = `You are a Certified Financial Planner in Canada. Create a comprehensive financial plan for:
Name: ${client?.name ?? 'Client'}
Annual Income: ${client?.annual_income ? fmt$(Number(client.annual_income)) : 'unknown'}
Investable Assets: ${client?.investable_assets ? fmt$(Number(client.investable_assets)) : 'unknown'}
Risk Tolerance: ${client?.risk_tolerance ?? 'moderate'}
Investment Horizon: ${client?.investment_horizon ?? 'unknown'}
Primary Goal: ${client?.primary_goal ?? 'Retirement'}
RRSP Room: ${client?.rrsp_room ? fmt$(Number(client.rrsp_room)) : 'unknown'}
TFSA Room: ${client?.tfsa_room ? fmt$(Number(client.tfsa_room)) : 'unknown'}
FHSA Eligible: ${client?.fhsa_eligible ? 'Yes' : 'No'}
Provide specific, actionable recommendations covering: account prioritization, asset allocation, and timeline.`;
    } else if (aiMode === 'tax') {
      prompt = `You are a Canadian tax and financial planning expert. Provide RRSP vs TFSA vs FHSA optimization advice for:
Name: ${client?.name ?? 'Client'}
Annual Income: ${client?.annual_income ? fmt$(Number(client.annual_income)) : 'unknown'}
RRSP Room: ${client?.rrsp_room ? fmt$(Number(client.rrsp_room)) : 'unknown'}
TFSA Room: ${client?.tfsa_room ? fmt$(Number(client.tfsa_room)) : 'unknown'}
FHSA Eligible: ${client?.fhsa_eligible ? 'Yes' : 'No'}
Provide: contribution priority order, tax deduction amounts, withdrawal strategy, and income splitting tips if applicable.`;
    } else {
      prompt = `You are a portfolio rebalancing advisor. Suggest rebalancing steps for a ${aiAllocation} investor profile.
Client: ${client?.name ?? 'Client'}
Current investable assets: ${client?.investable_assets ? fmt$(Number(client.investable_assets)) : 'unknown'}
Target allocation: ${aiAllocation}
Accounts: ${accounts.map(a => `${a.account_type} at ${a.institution} (${fmt$(Number(a.current_value))})`).join(', ') || 'unknown'}
Provide specific ETF/fund recommendations, target percentages, and rebalancing steps.`;
    }
    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const d = await r.json() as { text?: string };
      setAiResult(d.text ?? '');
    } catch (e) { setAiResult(String(e)); }
    finally { setAiLoading(false); }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const riskBadge = (r: string) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RISK_COLORS[r] ?? 'bg-gray-100 text-gray-700'}`}>{r}</span>
  );
  const kycBadge = (completed: boolean) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${completed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
      {completed ? '✓ KYC' : 'KYC Pending'}
    </span>
  );

  const selectedClient = clients.find(c => c.id === selectedClientId);

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------
  const renderDashboard = () => {
    if (!dash) return null;
    const totalAum = Number(dash.aum.total_aum ?? 0);
    const clientCount = Number(dash.clients.total ?? 0);
    const avgPortfolio = clientCount > 0 ? totalAum / clientCount : 0;
    const maxAccountValue = Math.max(...dash.accounts_by_type.map(a => Number(a.total_value)), 1);
    const totalRisk = dash.risk_distribution.reduce((s, r) => s + Number(r.count), 0);

    return (
      <div className="space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-3xl font-bold text-indigo-600">{fmt$(totalAum)}</div>
            <div className="text-sm text-gray-500 mt-1">Total AUM</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-3xl font-bold text-blue-600">{clientCount}</div>
            <div className="text-sm text-gray-500 mt-1">Total Clients</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-3xl font-bold text-green-600">{fmt$(avgPortfolio)}</div>
            <div className="text-sm text-gray-500 mt-1">Avg Portfolio Size</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-3xl font-bold text-purple-600">{fmt$(Number(dash.contributions.annual_contributions ?? 0))}</div>
            <div className="text-sm text-gray-500 mt-1">Annual Contributions</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Accounts by type */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">AUM by Account Type</h3>
            <div className="space-y-3">
              {dash.accounts_by_type.map(a => (
                <div key={a.account_type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">{a.account_type}</span>
                    <span className="text-gray-500">{a.count} accts · {fmt$(Number(a.total_value))}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.round((Number(a.total_value)/maxAccountValue)*100)}%` }} />
                  </div>
                </div>
              ))}
              {dash.accounts_by_type.length === 0 && <div className="text-gray-400 text-sm text-center py-4">No accounts yet.</div>}
            </div>
          </div>

          {/* Risk tolerance distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Risk Tolerance Distribution</h3>
            <div className="space-y-3">
              {dash.risk_distribution.map(r => (
                <div key={r.risk_tolerance}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RISK_COLORS[r.risk_tolerance] ?? 'bg-gray-100 text-gray-700'}`}>{r.risk_tolerance}</span>
                    <span className="text-gray-500">{r.count} ({totalRisk > 0 ? Math.round((Number(r.count)/totalRisk)*100) : 0}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-400 rounded-full" style={{ width: `${totalRisk > 0 ? Math.round((Number(r.count)/totalRisk)*100) : 0}%` }} />
                  </div>
                </div>
              ))}
              {dash.risk_distribution.length === 0 && <div className="text-gray-400 text-sm text-center py-4">No clients yet.</div>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Clients tab
  // ---------------------------------------------------------------------------
  const renderClients = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">Clients ({clients.length})</h3>
        <button onClick={() => setShowAddClient(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ Add Client</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="pb-2 pr-4">Name</th>
              <th className="pb-2 pr-4">Risk</th>
              <th className="pb-2 pr-4">Assets</th>
              <th className="pb-2 pr-4">Goal</th>
              <th className="pb-2 pr-4">KYC</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedClientId(c.id); setTab('portfolios'); }}>
                <td className="py-2 pr-4">
                  <div className="font-medium text-gray-900">{c.name}</div>
                  <div className="text-gray-400 text-xs">{c.email}</div>
                </td>
                <td className="py-2 pr-4">{riskBadge(c.risk_tolerance)}</td>
                <td className="py-2 pr-4 text-gray-700">{c.investable_assets ? fmt$(Number(c.investable_assets)) : '—'}</td>
                <td className="py-2 pr-4 text-gray-600 text-xs">{c.primary_goal}</td>
                <td className="py-2 pr-4">{kycBadge(c.kyc_completed)}</td>
                <td className="py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${c.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && <div className="text-center text-gray-400 py-8">No clients yet. Add your first client.</div>}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Portfolios tab
  // ---------------------------------------------------------------------------
  const renderPortfolios = () => {
    const gain = accounts.reduce((s, a) => s + Number(a.unrealized_gain ?? 0), 0);
    const totalValue = accounts.reduce((s, a) => s + Number(a.current_value ?? 0), 0);

    return (
      <div className="space-y-4">
        {/* Client selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="text-sm text-gray-600 font-medium block mb-2">Select Client</label>
          <select
            value={selectedClientId ?? ''}
            onChange={e => setSelectedClientId(Number(e.target.value) || null)}
            className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">— choose client —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {selectedClient && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold text-indigo-900">{selectedClient.name}</div>
                <div className="text-indigo-600 text-sm">{riskBadge(selectedClient.risk_tolerance)} · {selectedClient.investment_horizon} · {selectedClient.primary_goal}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-indigo-700">{fmt$(totalValue)}</div>
                <div className={`text-sm font-medium ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {gain >= 0 ? '+' : ''}{fmt$dec(gain)} unrealized
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedClientId && (
          <>
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Accounts ({accounts.length})</h3>
              <button onClick={() => setShowAddAccount(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ Add Account</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {accounts.map(a => {
                const g = Number(a.unrealized_gain ?? 0);
                return (
                  <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-semibold text-gray-900">{a.account_type}</div>
                        <div className="text-gray-500 text-xs">{a.institution}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{fmt$(Number(a.current_value ?? 0))}</div>
                    <div className="text-xs text-gray-500 mt-1">Book: {fmt$(Number(a.book_value ?? 0))}</div>
                    <div className={`text-sm font-medium mt-1 ${g >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {g >= 0 ? '+' : ''}{fmt$dec(g)} ({g !== 0 && Number(a.book_value) > 0 ? ((g / Number(a.book_value)) * 100).toFixed(1) + '%' : '—'})
                    </div>
                    {a.annual_contribution && (
                      <div className="text-xs text-gray-400 mt-1">Annual contrib: {fmt$(Number(a.annual_contribution))}</div>
                    )}
                    {a.opened_date && (
                      <div className="text-xs text-gray-400">Opened: {a.opened_date?.slice(0, 10)}</div>
                    )}
                  </div>
                );
              })}
              {accounts.length === 0 && <div className="col-span-3 text-center text-gray-400 py-8">No accounts for this client.</div>}
            </div>
          </>
        )}

        {!selectedClientId && (
          <div className="text-center text-gray-400 py-12">Select a client to view their portfolio.</div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // AI Planning tab
  // ---------------------------------------------------------------------------
  const renderAiPlanning = () => (
    <div className="space-y-6 max-w-2xl">
      <h3 className="font-semibold text-gray-800">AI Financial Planning</h3>

      {/* Mode selector */}
      <div className="flex gap-2 flex-wrap">
        {(['plan', 'tax', 'rebalance'] as const).map(m => (
          <button key={m} onClick={() => setAiMode(m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${aiMode === m ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            {m === 'plan' ? 'Generate Financial Plan' : m === 'tax' ? 'Tax Optimizer' : 'Rebalance Advice'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label className="text-sm text-gray-600 font-medium block mb-2">Client</label>
          <select value={aiClientId} onChange={e => { setAiClientId(e.target.value); if (e.target.value) loadAccounts(Number(e.target.value)); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">— select client —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} · {c.risk_tolerance} · {c.primary_goal}</option>)}
          </select>
        </div>

        {aiMode === 'rebalance' && (
          <div>
            <label className="text-sm text-gray-600 font-medium block mb-2">Target Allocation</label>
            <select value={aiAllocation} onChange={e => setAiAllocation(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {RISK_TOLERANCES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
        )}

        {aiMode === 'plan' && (
          <p className="text-sm text-gray-500">Generates a comprehensive financial plan based on the selected client&apos;s profile including account prioritization, asset allocation, and timeline.</p>
        )}
        {aiMode === 'tax' && (
          <p className="text-sm text-gray-500">Analyzes RRSP vs TFSA vs FHSA priority, contribution amounts, withdrawal strategy, and income-splitting tips for the selected client.</p>
        )}
        {aiMode === 'rebalance' && (
          <p className="text-sm text-gray-500">Provides specific rebalancing steps, ETF recommendations, and target percentages for the selected allocation profile.</p>
        )}

        <button onClick={runAi} disabled={aiLoading || !aiClientId}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
          {aiLoading ? 'Generating…' : `Generate ${aiMode === 'plan' ? 'Plan' : aiMode === 'tax' ? 'Tax Advice' : 'Rebalance Advice'}`}
        </button>

        {aiResult && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {aiResult}
          </div>
        )}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Compliance tab
  // ---------------------------------------------------------------------------
  const renderCompliance = () => {
    const today = new Date();
    const oneYearAgo = new Date(today); oneYearAgo.setFullYear(today.getFullYear() - 1);

    const kycPending = clients.filter(c => !c.kyc_completed);
    const kycStale = clients.filter(c => c.kyc_completed && c.kyc_date && new Date(c.kyc_date) < oneYearAgo);

    return (
      <div className="space-y-6">
        {/* KYC summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-700">{clients.filter(c => c.kyc_completed).length}</div>
            <div className="text-sm text-green-600 mt-1">KYC Complete</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{kycPending.length}</div>
            <div className="text-sm text-red-600 mt-1">KYC Pending</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-yellow-600">{kycStale.length}</div>
            <div className="text-sm text-yellow-600 mt-1">KYC Stale (&gt;12 months)</div>
          </div>
        </div>

        {/* KYC Pending */}
        {kycPending.length > 0 && (
          <div className="bg-white rounded-xl border border-red-200 p-5">
            <h3 className="font-semibold text-red-700 mb-3">KYC Pending — Action Required</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 pr-4">Client</th><th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Investable Assets</th><th className="pb-2">Action</th>
                </tr></thead>
                <tbody>
                  {kycPending.map(c => (
                    <tr key={c.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-gray-400 text-xs">{c.email}</div>
                      </td>
                      <td className="py-2 pr-4">{kycBadge(c.kyc_completed)}</td>
                      <td className="py-2 pr-4">{c.investable_assets ? fmt$(Number(c.investable_assets)) : '—'}</td>
                      <td className="py-2">
                        <button onClick={() => markKyc(c.id)} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200">
                          Mark KYC Complete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* KYC Stale */}
        {kycStale.length > 0 && (
          <div className="bg-white rounded-xl border border-yellow-200 p-5">
            <h3 className="font-semibold text-yellow-700 mb-3">KYC Stale — Review Required</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 pr-4">Client</th><th className="pb-2 pr-4">KYC Date</th>
                  <th className="pb-2 pr-4">Age (months)</th><th className="pb-2">Action</th>
                </tr></thead>
                <tbody>
                  {kycStale.map(c => {
                    const months = c.kyc_date ? Math.floor((Date.now() - new Date(c.kyc_date).getTime()) / (1000*60*60*24*30)) : null;
                    return (
                      <tr key={c.id} className="border-b border-gray-100">
                        <td className="py-2 pr-4">
                          <div className="font-medium">{c.name}</div>
                          <div className="text-gray-400 text-xs">{c.email}</div>
                        </td>
                        <td className="py-2 pr-4 text-gray-600 text-xs">{c.kyc_date?.slice(0,10)}</td>
                        <td className="py-2 pr-4">
                          <span className="text-yellow-700 font-medium">{months ? `${months} months` : '—'}</span>
                        </td>
                        <td className="py-2">
                          <button onClick={() => markKyc(c.id)} className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded hover:bg-yellow-200">
                            Renew KYC
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* All clients suitability table */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">All Clients — Suitability Overview</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-2 pr-4">Name</th><th className="pb-2 pr-4">Risk</th>
                <th className="pb-2 pr-4">Goal</th><th className="pb-2 pr-4">Horizon</th>
                <th className="pb-2 pr-4">KYC</th><th className="pb-2">Notes</th>
              </tr></thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-medium">{c.name}</td>
                    <td className="py-2 pr-4">{riskBadge(c.risk_tolerance)}</td>
                    <td className="py-2 pr-4 text-gray-600 text-xs">{c.primary_goal}</td>
                    <td className="py-2 pr-4 text-gray-500 text-xs">{c.investment_horizon}</td>
                    <td className="py-2 pr-4">{kycBadge(c.kyc_completed)}</td>
                    <td className="py-2 text-gray-400 text-xs truncate max-w-xs">{c.advisor_notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {clients.length === 0 && <div className="text-center text-gray-400 py-6">No clients yet.</div>}
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Modals
  // ---------------------------------------------------------------------------
  const Modal = ({ title, onClose, onSubmit, children }: { title: string; onClose: () => void; onSubmit: () => void; children: React.ReactNode }) => (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-screen overflow-y-auto">
        <div className="p-5 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
        <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={onSubmit} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">Save</button>
        </div>
      </div>
    </div>
  );

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label className="text-xs text-gray-600 block mb-1">{label}</label>{children}</div>
  );
  const I = ({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) => (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
  );
  const S = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{children}</select>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Financial Advisor</h1>
        <p className="text-gray-500 text-sm mt-1">Manage client portfolios, AUM, compliance and AI-powered planning.</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="p-6 max-w-7xl mx-auto">
        {loading && <div className="text-center py-12 text-gray-400">Loading…</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">{error}</div>}
        {!loading && (
          <>
            {tab === 'dashboard'   && renderDashboard()}
            {tab === 'clients'     && renderClients()}
            {tab === 'portfolios'  && renderPortfolios()}
            {tab === 'ai-planning' && renderAiPlanning()}
            {tab === 'compliance'  && renderCompliance()}
          </>
        )}
      </div>

      {/* Add Client Modal */}
      {showAddClient && (
        <Modal title="Add Client" onClose={() => setShowAddClient(false)} onSubmit={submitClient}>
          <F label="Full Name *"><I value={clientForm.name} onChange={v => setClientForm(p => ({ ...p, name: v }))} placeholder="Jane Smith" /></F>
          <F label="Email"><I type="email" value={clientForm.email} onChange={v => setClientForm(p => ({ ...p, email: v }))} /></F>
          <F label="Phone"><I value={clientForm.phone} onChange={v => setClientForm(p => ({ ...p, phone: v }))} placeholder="403-555-0100" /></F>
          <F label="Date of Birth"><I type="date" value={clientForm.date_of_birth} onChange={v => setClientForm(p => ({ ...p, date_of_birth: v }))} /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Annual Income ($)"><I type="number" value={clientForm.annual_income} onChange={v => setClientForm(p => ({ ...p, annual_income: v }))} placeholder="80000" /></F>
            <F label="Investable Assets ($)"><I type="number" value={clientForm.investable_assets} onChange={v => setClientForm(p => ({ ...p, investable_assets: v }))} placeholder="150000" /></F>
          </div>
          <F label="Risk Tolerance">
            <S value={clientForm.risk_tolerance} onChange={v => setClientForm(p => ({ ...p, risk_tolerance: v }))}>
              {RISK_TOLERANCES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </S>
          </F>
          <F label="Investment Horizon">
            <S value={clientForm.investment_horizon} onChange={v => setClientForm(p => ({ ...p, investment_horizon: v }))}>
              {INVESTMENT_HORIZONS.map(h => <option key={h} value={h}>{h}</option>)}
            </S>
          </F>
          <F label="Primary Goal">
            <S value={clientForm.primary_goal} onChange={v => setClientForm(p => ({ ...p, primary_goal: v }))}>
              {PRIMARY_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
            </S>
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="RRSP Room ($)"><I type="number" value={clientForm.rrsp_room} onChange={v => setClientForm(p => ({ ...p, rrsp_room: v }))} /></F>
            <F label="TFSA Room ($)"><I type="number" value={clientForm.tfsa_room} onChange={v => setClientForm(p => ({ ...p, tfsa_room: v }))} /></F>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={clientForm.fhsa_eligible} onChange={e => setClientForm(p => ({ ...p, fhsa_eligible: e.target.checked }))} className="rounded" />
            FHSA Eligible (first-time home buyer)
          </label>
        </Modal>
      )}

      {/* Add Account Modal */}
      {showAddAccount && (
        <Modal title="Add Account" onClose={() => setShowAddAccount(false)} onSubmit={submitAccount}>
          {!selectedClientId && (
            <F label="Client ID"><I type="number" value={accountForm.client_id} onChange={v => setAccountForm(p => ({ ...p, client_id: v }))} /></F>
          )}
          <F label="Account Type">
            <S value={accountForm.account_type} onChange={v => setAccountForm(p => ({ ...p, account_type: v }))}>
              {ACCOUNT_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
            </S>
          </F>
          <F label="Institution">
            <S value={accountForm.institution} onChange={v => setAccountForm(p => ({ ...p, institution: v }))}>
              {INSTITUTIONS.map(i => <option key={i} value={i}>{i}</option>)}
            </S>
          </F>
          <F label="Account Number"><I value={accountForm.account_number} onChange={v => setAccountForm(p => ({ ...p, account_number: v }))} placeholder="Optional" /></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Current Value ($)"><I type="number" value={accountForm.current_value} onChange={v => setAccountForm(p => ({ ...p, current_value: v }))} /></F>
            <F label="Book Value ($)"><I type="number" value={accountForm.book_value} onChange={v => setAccountForm(p => ({ ...p, book_value: v }))} /></F>
          </div>
          <F label="Annual Contribution ($)"><I type="number" value={accountForm.annual_contribution} onChange={v => setAccountForm(p => ({ ...p, annual_contribution: v }))} /></F>
          <F label="Opened Date"><I type="date" value={accountForm.opened_date} onChange={v => setAccountForm(p => ({ ...p, opened_date: v }))} /></F>
        </Modal>
      )}
    </div>
  );
}
