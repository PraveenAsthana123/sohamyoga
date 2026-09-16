'use client';

import { useEffect, useState, useCallback } from 'react';

interface MlRun {
  id: number;
  model_name: string;
  model_type: string | null;
  run_type: string;
  status: string;
  accuracy: number | null;
  loss: number | null;
  epochs: number | null;
  training_samples: number | null;
  inference_count: number;
  duration_ms: number | null;
  notes: string | null;
  created_at: string;
}

const glass = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl';
const tabBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
const tabActive = 'bg-white/20 text-white';
const tabInactive = 'text-white/60 hover:bg-white/10';

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/30 text-green-200',
  running: 'bg-blue-500/30 text-blue-200',
  pending: 'bg-amber-500/30 text-amber-200',
  failed: 'bg-red-500/30 text-red-200',
};

type Tab = 'overview' | 'registry' | 'rnn' | 'rl' | 'training' | 'inference';

export default function MlTechnicalPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [runs, setRuns] = useState<MlRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [rnnForm, setRnnForm] = useState({ model_name: 'RNN-v1', epochs: '', accuracy: '', loss: '', training_samples: '' });
  const [rlForm, setRlForm] = useState({ model_name: 'RL-BidOpt-v1', epochs: '', accuracy: '', notes: '' });
  const [trainForm, setTrainForm] = useState({ model_name: '', model_type: 'classification', epochs: '', accuracy: '', loss: '', training_samples: '', notes: '' });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ml-technical');
      const data = await res.json() as { runs: MlRun[] };
      setRuns(data.runs || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const logRun = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/admin/ml-technical', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) { showToast('Run logged'); load(); }
    else showToast('Error logging run');
  };

  const totalRuns = runs.length;
  const avgAccuracy = runs.filter((r) => r.accuracy !== null).length
    ? (runs.filter((r) => r.accuracy !== null).reduce((s, r) => s + Number(r.accuracy), 0) / runs.filter((r) => r.accuracy !== null).length * 100).toFixed(1)
    : '—';
  const uniqueModels = [...new Set(runs.map((r) => r.model_name))].length;
  const totalInferences = runs.reduce((s, r) => s + r.inference_count, 0);

  const rnnRuns = runs.filter((r) => r.model_type === 'rnn');
  const rlRuns = runs.filter((r) => r.model_type === 'reinforcement');
  const trainingRuns = runs.filter((r) => r.run_type === 'training' || r.run_type === 'fine-tune');
  const inferenceRuns = runs.filter((r) => r.run_type === 'inference');

  const modelGroups = runs.reduce<Record<string, MlRun[]>>((acc, r) => {
    const key = r.model_type || 'other';
    acc[key] = [...(acc[key] || []), r];
    return acc;
  }, {});

  const RunTable = ({ data }: { data: MlRun[] }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-white/80">
        <thead><tr className="border-b border-white/20 text-white/60">
          <th className="pb-2 text-left">Model</th>
          <th className="pb-2 text-left">Type</th>
          <th className="pb-2 text-left">Run</th>
          <th className="pb-2 text-left">Status</th>
          <th className="pb-2 text-left">Accuracy</th>
          <th className="pb-2 text-left">Loss</th>
          <th className="pb-2 text-left">Duration</th>
          <th className="pb-2 text-left">Date</th>
        </tr></thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.id} className="border-b border-white/10">
              <td className="py-2 font-medium text-white">{r.model_name}</td>
              <td className="py-2 text-xs">{r.model_type || '—'}</td>
              <td className="py-2 text-xs">{r.run_type}</td>
              <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[r.status] || 'bg-white/20 text-white'}`}>{r.status}</span></td>
              <td className="py-2">{r.accuracy !== null ? `${(Number(r.accuracy) * 100).toFixed(1)}%` : '—'}</td>
              <td className="py-2">{r.loss !== null ? Number(r.loss).toFixed(4) : '—'}</td>
              <td className="py-2">{r.duration_ms ? `${r.duration_ms}ms` : '—'}</td>
              <td className="py-2 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data.length && <p className="py-8 text-center text-white/40">No runs yet</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-900 to-slate-900 p-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl bg-white/20 px-4 py-2 text-white backdrop-blur-md shadow-xl">{toast}</div>
      )}
      <h1 className="mb-6 text-3xl font-bold text-white">ML Technical Dashboard 🤖</h1>

      <div className="mb-6 flex gap-2 flex-wrap">
        {(['overview','registry','rnn','rl','training','inference'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`${tabBase} ${tab === t ? tabActive : tabInactive}`}>
            {t === 'overview' ? 'ML Overview' : t === 'registry' ? 'Model Registry' : t === 'rnn' ? 'RNN Module' : t === 'rl' ? 'Reinforcement Learning' : t === 'training' ? 'Training Monitor' : 'Inference Logs'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total Runs', value: totalRuns },
              { label: 'Avg Accuracy', value: avgConfStr(avgAccuracy) },
              { label: 'Active Models', value: uniqueModels },
              { label: 'Total Inferences', value: totalInferences },
            ].map(({ label, value }) => (
              <div key={label} className={glass}>
                <p className="text-xs text-white/60 uppercase tracking-wide">{label}</p>
                <p className="text-3xl font-bold text-white">{value}</p>
              </div>
            ))}
          </div>
          <div className={glass}>
            <h3 className="mb-4 text-lg font-semibold text-white">Recent Runs</h3>
            {loading ? <p className="text-white/60">Loading…</p> : <RunTable data={runs.slice(0, 10)} />}
          </div>
        </div>
      )}

      {tab === 'registry' && (
        <div className="space-y-4">
          {Object.entries(modelGroups).map(([type, typeRuns]) => {
            const byModel = typeRuns.reduce<Record<string, MlRun[]>>((acc, r) => {
              acc[r.model_name] = [...(acc[r.model_name] || []), r];
              return acc;
            }, {});
            return (
              <div key={type} className={glass}>
                <h3 className="mb-3 text-lg font-semibold text-white capitalize">{type}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(byModel).map(([modelName, modelRuns]) => {
                    const last = modelRuns[0];
                    const avgAcc = modelRuns.filter((r) => r.accuracy !== null).length
                      ? modelRuns.filter((r) => r.accuracy !== null).reduce((s, r) => s + Number(r.accuracy), 0) / modelRuns.filter((r) => r.accuracy !== null).length
                      : null;
                    const totalInf = modelRuns.reduce((s, r) => s + r.inference_count, 0);
                    return (
                      <div key={modelName} className="rounded-xl bg-white/5 border border-white/10 p-4">
                        <p className="font-semibold text-white mb-1">{modelName}</p>
                        <p className="text-xs text-white/50 mb-2">Last: {new Date(last.created_at).toLocaleDateString()}</p>
                        <div className="flex gap-3 text-xs text-white/60">
                          <span><span className={`rounded-full px-1.5 py-0.5 mr-1 ${STATUS_COLORS[last.status] || 'bg-white/20 text-white'}`}>{last.status}</span></span>
                          {avgAcc !== null && <span>Acc: {(avgAcc * 100).toFixed(1)}%</span>}
                          <span>{totalInf} inferences</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {!Object.keys(modelGroups).length && <div className={glass}><p className="text-white/40">No models logged yet</p></div>}
        </div>
      )}

      {tab === 'rnn' && (
        <div className="space-y-6">
          <div className={glass}>
            <h2 className="mb-4 text-xl font-semibold text-white">Recurrent Neural Network (RNN)</h2>
            <div className="rounded-xl bg-violet-500/20 border border-violet-400/30 p-4 mb-4 font-mono text-sm text-violet-200">
              <p className="mb-2 font-bold text-white">Architecture:</p>
              <p>h_t = tanh(W_x · x_t + W_h · h_(t-1) + b)</p>
              <p>output_t = W_o · h_t + b_o</p>
            </div>
            {/* RNN Unrolled Diagram */}
            <div className="overflow-x-auto mb-4">
              <div className="flex items-center gap-2 min-w-max">
                {['t-2','t-1','t'].map((step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    {i > 0 && <div className="text-white/40 text-xl">→</div>}
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-xl bg-blue-500/30 border border-blue-400/40 px-4 py-2 text-center">
                        <p className="text-xs text-blue-200">Input x_{step}</p>
                      </div>
                      <div className="w-px h-4 bg-white/30" />
                      <div className="rounded-xl bg-violet-500/30 border border-violet-400/40 px-4 py-3 text-center">
                        <p className="text-xs text-violet-200 font-semibold">Hidden h_{step}</p>
                        <p className="text-xs text-white/40">tanh(Wx·x + Wh·h)</p>
                      </div>
                      <div className="w-px h-4 bg-white/30" />
                      <div className="rounded-xl bg-green-500/30 border border-green-400/40 px-4 py-2 text-center">
                        <p className="text-xs text-green-200">Output y_{step}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <h3 className="mb-2 font-semibold text-white">Use Cases</h3>
            <table className="w-full text-sm mb-4">
              <thead><tr className="border-b border-white/20 text-white/60"><th className="pb-1 text-left">Application</th><th className="pb-1 text-left">Description</th></tr></thead>
              <tbody>
                {[
                  ['Sequence Prediction', 'Predict next items in a purchase or content sequence'],
                  ['Time-Series Forecasting', 'Revenue, orders, or traffic forecasting'],
                  ['NLP', 'Text generation, sentiment, classification'],
                  ['Gesture Recognition', 'User interaction pattern detection'],
                ].map(([app, desc]) => (
                  <tr key={String(app)} className="border-b border-white/10">
                    <td className="py-1 font-medium text-white/80">{app}</td>
                    <td className="py-1 text-white/50">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={glass}>
            <h3 className="mb-4 text-lg font-semibold text-white">Log RNN Run</h3>
            <form onSubmit={async (e) => { e.preventDefault(); await logRun({ ...rnnForm, model_type: 'rnn', run_type: 'training', status: 'completed', accuracy: rnnForm.accuracy ? parseFloat(rnnForm.accuracy) / 100 : null, loss: rnnForm.loss ? parseFloat(rnnForm.loss) : null, epochs: rnnForm.epochs ? parseInt(rnnForm.epochs) : null, training_samples: rnnForm.training_samples ? parseInt(rnnForm.training_samples) : null }); }} className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Model Name', key: 'model_name', type: 'text', required: true },
                { label: 'Epochs', key: 'epochs', type: 'number' },
                { label: 'Accuracy (%)', key: 'accuracy', type: 'number', step: '0.01' },
                { label: 'Loss', key: 'loss', type: 'number', step: '0.0001' },
                { label: 'Training Samples', key: 'training_samples', type: 'number' },
              ].map(({ label, key, type, required, step }) => (
                <div key={key}>
                  <label className="mb-1 block text-sm text-white/70">{label}</label>
                  <input type={type} required={required} step={step} value={(rnnForm as Record<string, string>)[key]}
                    onChange={(e) => setRnnForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none" />
                </div>
              ))}
              <div className="sm:col-span-2">
                <button type="submit" className="rounded-xl bg-violet-600 px-6 py-2 text-white font-semibold hover:bg-violet-500">Log RNN Run</button>
              </div>
            </form>
          </div>
          {rnnRuns.length > 0 && (
            <div className={glass}>
              <h3 className="mb-3 text-lg font-semibold text-white">Recent RNN Runs</h3>
              <RunTable data={rnnRuns.slice(0, 10)} />
            </div>
          )}
        </div>
      )}

      {tab === 'rl' && (
        <div className="space-y-6">
          <div className={glass}>
            <h2 className="mb-4 text-xl font-semibold text-white">Reinforcement Learning</h2>
            <div className="rounded-xl bg-orange-500/20 border border-orange-400/30 p-4 mb-4">
              <p className="font-semibold text-white mb-3">Agent ↔ Environment Loop</p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <div className="rounded-xl bg-blue-500/30 border border-blue-400/40 px-4 py-3 text-center">
                  <p className="font-semibold text-blue-200">Agent</p>
                  <p className="text-xs text-white/50">Takes Action a</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-white/40 text-sm">Action →</span>
                  <span className="text-white/40 text-sm">← State + Reward</span>
                </div>
                <div className="rounded-xl bg-green-500/30 border border-green-400/40 px-4 py-3 text-center">
                  <p className="font-semibold text-green-200">Environment</p>
                  <p className="text-xs text-white/50">Returns State s&apos;, Reward r</p>
                </div>
                <div className="rounded-xl bg-amber-500/30 border border-amber-400/40 px-4 py-3 text-center">
                  <p className="font-semibold text-amber-200">Reward r</p>
                  <p className="text-xs text-white/50">Updates Policy π</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              {[
                { title: 'Policy π(a|s)', desc: 'Probability of taking action a in state s' },
                { title: 'Value Function V(s)', desc: 'Expected cumulative reward from state s' },
                { title: 'Q-Function Q(s,a)', desc: 'Expected reward for action a in state s' },
                { title: 'Bellman Equation', desc: 'V(s) = max_a [r(s,a) + γ·V(s\')]' },
              ].map(({ title, desc }) => (
                <div key={title} className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <p className="font-mono text-amber-300 text-sm">{title}</p>
                  <p className="text-xs text-white/60 mt-1">{desc}</p>
                </div>
              ))}
            </div>
            <h3 className="mb-2 font-semibold text-white">RL for Marketing</h3>
            <div className="grid gap-2 sm:grid-cols-2 mb-4">
              {[
                { use: 'Bid Optimization', desc: 'Maximize ROAS by learning optimal ad bids dynamically' },
                { use: 'Content Recommendation', desc: 'Learn which content leads to highest engagement' },
                { use: 'Email Timing', desc: 'Optimize send time per user based on open rate feedback' },
                { use: 'Dynamic Pricing', desc: 'Adjust prices based on demand signals and conversion' },
              ].map(({ use, desc }) => (
                <div key={use} className="rounded-xl bg-orange-500/10 border border-orange-400/20 p-3">
                  <p className="font-semibold text-orange-200 text-sm">{use}</p>
                  <p className="text-xs text-white/50">{desc}</p>
                </div>
              ))}
            </div>
            <h3 className="mb-2 font-semibold text-white text-sm">Reward History (Simulated)</h3>
            <div className="flex items-end gap-1 h-16">
              {Array.from({ length: 20 }, (_, i) => ({
                ep: i + 1,
                reward: Math.max(0, Math.min(1, 0.2 + i * 0.035 + (Math.random() * 0.1 - 0.05))),
              })).map(({ ep, reward }) => (
                <div key={ep} className="flex-1 rounded-sm bg-orange-400/60" style={{ height: `${reward * 60}px` }} title={`Episode ${ep}: ${reward.toFixed(2)}`} />
              ))}
            </div>
            <p className="text-xs text-white/30 mt-1">Simulated reward curve over episodes — replace with real RL training log data.</p>
          </div>
          <div className={glass}>
            <h3 className="mb-4 text-lg font-semibold text-white">Log RL Run</h3>
            <form onSubmit={async (e) => { e.preventDefault(); await logRun({ ...rlForm, model_type: 'reinforcement', run_type: 'training', status: 'completed', accuracy: rlForm.accuracy ? parseFloat(rlForm.accuracy) / 100 : null, epochs: rlForm.epochs ? parseInt(rlForm.epochs) : null }); }} className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Model Name', key: 'model_name', required: true },
                { label: 'Episodes (Epochs)', key: 'epochs', type: 'number' },
                { label: 'Final Reward (%)', key: 'accuracy', type: 'number', step: '0.01' },
              ].map(({ label, key, type, required, step }) => (
                <div key={key}>
                  <label className="mb-1 block text-sm text-white/70">{label}</label>
                  <input type={type || 'text'} required={required} step={step} value={(rlForm as Record<string, string>)[key]}
                    onChange={(e) => setRlForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none" />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-sm text-white/70">Notes</label>
                <input value={rlForm.notes} onChange={(e) => setRlForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" className="rounded-xl bg-orange-600 px-6 py-2 text-white font-semibold hover:bg-orange-500">Log RL Run</button>
              </div>
            </form>
          </div>
          {rlRuns.length > 0 && (
            <div className={glass}>
              <h3 className="mb-3 text-lg font-semibold text-white">Recent RL Runs</h3>
              <RunTable data={rlRuns.slice(0, 10)} />
            </div>
          )}
        </div>
      )}

      {tab === 'training' && (
        <div className="space-y-6">
          <div className={glass}>
            <h2 className="mb-4 text-xl font-semibold text-white">Training Monitor</h2>
            {trainingRuns.length > 0 ? (
              <div className="space-y-4">
                {trainingRuns.slice(0, 5).map((r) => (
                  <div key={r.id} className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-white">{r.model_name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                    </div>
                    {r.accuracy !== null && (
                      <div className="mb-1">
                        <p className="text-xs text-white/50 mb-1">Accuracy: {(Number(r.accuracy) * 100).toFixed(1)}%</p>
                        <div className="h-2 rounded-full bg-white/10">
                          <div className="h-2 rounded-full bg-green-400/70" style={{ width: `${Number(r.accuracy) * 100}%` }} />
                        </div>
                      </div>
                    )}
                    {r.loss !== null && (
                      <p className="text-xs text-white/50">Loss: {Number(r.loss).toFixed(4)}</p>
                    )}
                    <p className="text-xs text-white/30 mt-1">{r.epochs} epochs · {r.training_samples?.toLocaleString()} samples · {r.duration_ms}ms</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-white/40">No training runs logged yet</p>}
          </div>
          <div className={glass}>
            <h3 className="mb-4 text-lg font-semibold text-white">Log New Training Run</h3>
            <form onSubmit={async (e) => { e.preventDefault(); await logRun({ ...trainForm, run_type: 'training', status: 'completed', accuracy: trainForm.accuracy ? parseFloat(trainForm.accuracy) / 100 : null, loss: trainForm.loss ? parseFloat(trainForm.loss) : null, epochs: trainForm.epochs ? parseInt(trainForm.epochs) : null, training_samples: trainForm.training_samples ? parseInt(trainForm.training_samples) : null }); }} className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Model Name *', key: 'model_name', required: true },
                { label: 'Epochs', key: 'epochs', type: 'number' },
                { label: 'Accuracy (%)', key: 'accuracy', type: 'number', step: '0.01' },
                { label: 'Loss', key: 'loss', type: 'number', step: '0.0001' },
                { label: 'Training Samples', key: 'training_samples', type: 'number' },
              ].map(({ label, key, type, required, step }) => (
                <div key={key}>
                  <label className="mb-1 block text-sm text-white/70">{label}</label>
                  <input type={type || 'text'} required={required} step={step} value={(trainForm as Record<string, string>)[key]}
                    onChange={(e) => setTrainForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none" />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-sm text-white/70">Model Type</label>
                <select value={trainForm.model_type} onChange={(e) => setTrainForm((f) => ({ ...f, model_type: e.target.value }))}
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white focus:outline-none">
                  {['classification','regression','clustering','rnn','reinforcement','nlp'].map((t) => <option key={t} value={t} className="bg-slate-800">{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/70">Notes</label>
                <input value={trainForm.notes} onChange={(e) => setTrainForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/40 focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" className="rounded-xl bg-violet-600 px-6 py-2 text-white font-semibold hover:bg-violet-500">Log Training Run</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tab === 'inference' && (
        <div className="space-y-6">
          <div className={glass}>
            <h2 className="mb-4 text-xl font-semibold text-white">Inference Logs</h2>
            <RunTable data={inferenceRuns} />
          </div>
          {inferenceRuns.length > 0 && (
            <div className={glass}>
              <h3 className="mb-3 text-lg font-semibold text-white">Cumulative Inference Count</h3>
              <div className="flex items-end gap-1 h-24">
                {inferenceRuns.slice(0, 30).map((r, i) => {
                  const maxInf = Math.max(...inferenceRuns.slice(0, 30).map((x) => x.inference_count), 1);
                  const h = Math.max(2, Math.round((r.inference_count / maxInf) * 80));
                  return (
                    <div key={r.id} className="flex-1 rounded-sm bg-violet-400/60" style={{ height: h }} title={`${r.model_name}: ${r.inference_count}`} />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function avgConfStr(v: string): string { return v === '—' ? '—' : `${v}%`; }
