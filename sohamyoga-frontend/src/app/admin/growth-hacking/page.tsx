'use client';
import { useEffect, useState, useCallback } from 'react';

type Tab = 'experiments' | 'ideation' | 'metrics' | 'playbook';
type ExperimentStatus = 'draft' | 'running' | 'concluded';

interface Experiment {
  id: number;
  name: string;
  hypothesis: string;
  status: ExperimentStatus;
  channel: string | null;
  metric: string | null;
  baseline_value: number | null;
  target_value: number | null;
  actual_value: number | null;
  start_date: string | null;
  end_date: string | null;
  result: string | null;
  learnings: string | null;
  created_at: string;
}

interface Stats {
  total: string;
  running: string;
  won: string;
  lost: string;
  uplift_avg: string | null;
  channels_tested: string;
}

const CHANNELS = ['SEO', 'Paid Search', 'Social Organic', 'Paid Social', 'Email', 'Referral', 'Content', 'PR', 'Partnership', 'Product'];
const RESULT_COLORS: Record<string, string> = {
  won: 'text-green-600 bg-green-50',
  lost: 'text-red-600 bg-red-50',
  inconclusive: 'text-yellow-600 bg-yellow-50',
};

const PLAYBOOK_TACTICS = [
  { channel: 'SEO', tactic: 'Topic cluster strategy', impact: 'High', effort: 'High', description: 'Build pillar pages + supporting cluster content to dominate topical authority.' },
  { channel: 'Email', tactic: 'Behavior-triggered sequences', impact: 'High', effort: 'Medium', description: 'Send emails based on user actions: page visits, cart abandon, feature usage.' },
  { channel: 'Paid Social', tactic: 'Lookalike audience expansion', impact: 'Medium', effort: 'Low', description: 'Use 1% lookalike of best customers, scale to 2-5% once ROAS proven.' },
  { channel: 'Product', tactic: 'Viral loop / referral mechanic', impact: 'High', effort: 'High', description: 'Build in-product sharing that rewards both referrer and referee.' },
  { channel: 'Content', tactic: 'Original data studies', impact: 'High', effort: 'High', description: 'Publish proprietary research; earns backlinks and establishes authority.' },
  { channel: 'Referral', tactic: 'Double-sided referral program', impact: 'High', effort: 'Medium', description: 'Both parties get value — drives word-of-mouth with clear incentive.' },
  { channel: 'Paid Search', tactic: 'Competitor keyword bidding', impact: 'Medium', effort: 'Low', description: 'Bid on competitor brand terms with strong comparison landing pages.' },
  { channel: 'PR', tactic: 'Reactive HARO outreach', impact: 'Medium', effort: 'Low', description: 'Respond to journalist queries — earns mentions in major publications.' },
  { channel: 'Social Organic', tactic: 'Creator/influencer seeding', impact: 'Medium', effort: 'Medium', description: 'Send product to micro-influencers in niche for authentic organic coverage.' },
  { channel: 'Partnership', tactic: 'Bundle deals with complementary tools', impact: 'High', effort: 'Medium', description: 'Integrate with tools your customers already use; co-market to each other\'s list.' },
];

export default function GrowthHackingPage() {
  const [tab, setTab] = useState<Tab>('experiments');
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Add experiment modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [expForm, setExpForm] = useState({ name: '', hypothesis: '', channel: '', metric: '', baseline_value: '', target_value: '', start_date: '' });

  // Conclude modal
  const [concludeId, setConcludeId] = useState<number | null>(null);
  const [concludeForm, setConcludeForm] = useState({ actual_value: '', result: 'won', learnings: '' });

  // Ideation
  const [ideaChannel, setIdeaChannel] = useState('SEO');
  const [ideaGoal, setIdeaGoal] = useState('');
  const [ideas, setIdeas] = useState('');
  const [ideaLoading, setIdeaLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/growth-hacking');
      const d = await r.json();
      setExperiments(d.experiments || []);
      setStats(d.stats || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddExp = async () => {
    if (!expForm.name || !expForm.hypothesis) return;
    await fetch('/api/admin/growth-hacking', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...expForm,
        baseline_value: expForm.baseline_value ? parseFloat(expForm.baseline_value) : null,
        target_value: expForm.target_value ? parseFloat(expForm.target_value) : null,
      }),
    });
    setShowAddModal(false);
    setExpForm({ name: '', hypothesis: '', channel: '', metric: '', baseline_value: '', target_value: '', start_date: '' });
    fetchData();
  };

  const handleStatusChange = async (id: number, status: ExperimentStatus) => {
    await fetch(`/api/admin/growth-hacking/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchData();
  };

  const handleConclude = async () => {
    if (!concludeId) return;
    await fetch(`/api/admin/growth-hacking/${concludeId}/conclude`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...concludeForm, actual_value: concludeForm.actual_value ? parseFloat(concludeForm.actual_value) : null }),
    });
    setConcludeId(null);
    setConcludeForm({ actual_value: '', result: 'won', learnings: '' });
    fetchData();
  };

  const handleIdeate = async () => {
    if (!ideaGoal) return;
    setIdeaLoading(true);
    setIdeas('');
    try {
      const r = await fetch('/api/admin/growth-hacking/ideate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: ideaChannel, goal: ideaGoal }),
      });
      const d = await r.json();
      setIdeas(d.ideas || d.error || 'No response');
    } catch {
      setIdeas('Failed to connect to API');
    } finally {
      setIdeaLoading(false);
    }
  };

  const byStatus = (s: ExperimentStatus) => experiments.filter(e => e.status === s);

  const calcUplift = (exp: Experiment) => {
    if (exp.actual_value != null && exp.baseline_value != null && exp.baseline_value !== 0) {
      const uplift = ((exp.actual_value - exp.baseline_value) / exp.baseline_value * 100).toFixed(1);
      return `${uplift}%`;
    }
    return null;
  };

  const TAB_LABELS: Record<Tab, string> = { experiments: 'Experiments', ideation: 'Ideation', metrics: 'Metrics', playbook: 'Playbook' };

  const ExperimentCard = ({ exp }: { exp: Experiment }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900 text-sm">{exp.name}</h3>
        {exp.result && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_COLORS[exp.result] || 'text-gray-600 bg-gray-100'}`}>{exp.result}</span>
        )}
      </div>
      <p className="text-xs text-gray-600 mb-3 leading-relaxed">{exp.hypothesis}</p>
      <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
        {exp.channel && <span className="bg-gray-100 px-2 py-0.5 rounded">{exp.channel}</span>}
        {exp.metric && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{exp.metric}</span>}
      </div>
      {(exp.baseline_value != null || exp.target_value != null) && (
        <div className="flex gap-3 text-xs mb-3">
          {exp.baseline_value != null && <span className="text-gray-500">Base: <strong>{exp.baseline_value}</strong></span>}
          {exp.target_value != null && <span className="text-gray-500">Target: <strong>{exp.target_value}</strong></span>}
          {exp.actual_value != null && <span className="text-gray-500">Actual: <strong className={exp.result === 'won' ? 'text-green-600' : 'text-red-600'}>{exp.actual_value}</strong></span>}
          {calcUplift(exp) && <span className={`font-medium ${parseFloat(calcUplift(exp)!) > 0 ? 'text-green-600' : 'text-red-600'}`}>{calcUplift(exp)} lift</span>}
        </div>
      )}
      <div className="flex gap-2">
        {exp.status === 'draft' && (
          <button onClick={() => handleStatusChange(exp.id, 'running')} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium">Start</button>
        )}
        {exp.status === 'running' && (
          <button onClick={() => { setConcludeId(exp.id); }} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium">Conclude</button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Growth Hacking</h1>
            <p className="text-gray-500 text-sm mt-1">Run structured growth experiments and track results</p>
          </div>
          {tab === 'experiments' && (
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              + New Experiment
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Experiments Tab — Kanban */}
        {tab === 'experiments' && (
          loading ? (
            <div className="text-center py-16 text-gray-400">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(['draft', 'running', 'concluded'] as ExperimentStatus[]).map(s => (
                <div key={s}>
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="font-semibold text-gray-700 capitalize">{s}</h2>
                    <span className="bg-gray-200 text-gray-600 text-xs rounded-full px-2 py-0.5">{byStatus(s).length}</span>
                  </div>
                  <div className="min-h-[200px] bg-gray-100 rounded-xl p-3">
                    {byStatus(s).length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">No {s} experiments</div>
                    ) : (
                      byStatus(s).map(exp => <ExperimentCard key={exp.id} exp={exp} />)
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Ideation Tab */}
        {tab === 'ideation' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Generate Growth Experiment Ideas</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                  <select value={ideaChannel} onChange={e => setIdeaChannel(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {CHANNELS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Goal</label>
                  <textarea
                    value={ideaGoal}
                    onChange={e => setIdeaGoal(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. Increase free trial sign-ups by 30% in Q4..."
                  />
                </div>
                <button onClick={handleIdeate} disabled={ideaLoading || !ideaGoal} className="w-full py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                  {ideaLoading ? 'Generating 5 ideas...' : 'Generate Ideas with AI'}
                </button>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 mb-3">AI-Generated Ideas</h2>
              {ideas ? (
                <div className="bg-gray-50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{ideas}</pre>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                  {ideaLoading ? 'Thinking...' : 'Ideas will appear here'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metrics Tab */}
        {tab === 'metrics' && stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Experiments', value: stats.total, color: 'text-gray-900' },
              { label: 'Running', value: stats.running, color: 'text-blue-600' },
              { label: 'Won', value: stats.won, color: 'text-green-600' },
              { label: 'Lost', value: stats.lost, color: 'text-red-600' },
              { label: 'Avg Uplift', value: stats.uplift_avg ? `${stats.uplift_avg}%` : 'N/A', color: 'text-purple-600' },
              { label: 'Channels Tested', value: stats.channels_tested, color: 'text-orange-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
            {stats && parseInt(stats.total) > 0 && parseInt(stats.won) + parseInt(stats.lost) > 0 && (
              <div className="col-span-2 md:col-span-3 lg:col-span-6 bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">Win Rate</div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${Math.round(parseInt(stats.won) / (parseInt(stats.won) + parseInt(stats.lost)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-green-600">
                    {Math.round(parseInt(stats.won) / (parseInt(stats.won) + parseInt(stats.lost)) * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Playbook Tab */}
        {tab === 'playbook' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PLAYBOOK_TACTICS.map(t => (
              <div key={t.tactic} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 text-sm">{t.tactic}</h3>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.impact === 'High' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>Impact: {t.impact}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.effort === 'Low' ? 'bg-green-100 text-green-700' : t.effort === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>Effort: {t.effort}</span>
                  </div>
                </div>
                <span className="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs mb-2">{t.channel}</span>
                <p className="text-xs text-gray-600 leading-relaxed">{t.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Experiment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Experiment</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input value={expForm.name} onChange={e => setExpForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Experiment name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hypothesis *</label>
                <textarea value={expForm.hypothesis} onChange={e => setExpForm(f => ({ ...f, hypothesis: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="If we do X, then Y will happen because Z..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                  <select value={expForm.channel} onChange={e => setExpForm(f => ({ ...f, channel: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Metric</label>
                  <input value={expForm.metric} onChange={e => setExpForm(f => ({ ...f, metric: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. CVR, CAC, CTR" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Baseline Value</label>
                  <input type="number" value={expForm.baseline_value} onChange={e => setExpForm(f => ({ ...f, baseline_value: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Current value" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Value</label>
                  <input type="number" value={expForm.target_value} onChange={e => setExpForm(f => ({ ...f, target_value: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Target value" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" value={expForm.start_date} onChange={e => setExpForm(f => ({ ...f, start_date: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleAddExp} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">Create</button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Conclude Modal */}
      {concludeId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Conclude Experiment</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Actual Value</label>
                <input type="number" value={concludeForm.actual_value} onChange={e => setConcludeForm(f => ({ ...f, actual_value: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Measured result" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Result</label>
                <div className="flex gap-2">
                  {['won', 'lost', 'inconclusive'].map(r => (
                    <button key={r} onClick={() => setConcludeForm(f => ({ ...f, result: r }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize ${concludeForm.result === r ? (r === 'won' ? 'bg-green-600 text-white' : r === 'lost' ? 'bg-red-600 text-white' : 'bg-yellow-500 text-white') : 'bg-gray-100 text-gray-700'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Learnings</label>
                <textarea value={concludeForm.learnings} onChange={e => setConcludeForm(f => ({ ...f, learnings: e.target.value }))} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="What did we learn? What should we try next?" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleConclude} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">Submit</button>
              <button onClick={() => setConcludeId(null)} className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
