import Link from 'next/link';
import { getMonitoringSnapshot } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

const SOURCE_STYLE: Record<string, string> = {
  live: 'bg-emerald-100 text-emerald-700',
  degraded: 'bg-amber-100 text-amber-700',
  offline: 'bg-rose-100 text-rose-700',
};

export default async function MonitoringPage() {
  const s = await getMonitoringSnapshot();

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-24 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-stone-200 bg-gradient-to-br from-primary-700 to-primary-900 p-8 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-primary-100">Operational dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Local AI operations</h1>
              <p className="mt-3 max-w-3xl text-sm text-primary-100 sm:text-base">
                Measured data only — live queue, loaded models, real Ollama timings, and real cloud budget.
                Nothing on this page is simulated.
              </p>
            </div>
            <Link href="/" className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/25">
              Back to home
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${SOURCE_STYLE[s.dataSource]}`}>
              {s.dataSource.toUpperCase()}
            </span>
            <span className="text-sm text-primary-100">{s.note}</span>
          </div>

          <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <div className="text-sm text-primary-100">Ollama</div>
              <div className="mt-2 text-3xl font-semibold">{s.ollamaUp ? 'Up' : 'Down'}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <div className="text-sm text-primary-100">Model in use</div>
              <div className="mt-2 text-lg font-semibold">{s.summary.modelInUse}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <div className="text-sm text-primary-100">Running / Queued</div>
              <div className="mt-2 text-3xl font-semibold">{s.summary.running} / {s.summary.queued}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <div className="text-sm text-primary-100">Installed models</div>
              <div className="mt-2 text-3xl font-semibold">{s.installedCount}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <div className="text-sm text-primary-100">Traced generations</div>
              <div className="mt-2 text-3xl font-semibold">{formatNumber(s.tracedGenerations)}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">What requests are running?</h2>
            <p className="mt-1 text-sm text-stone-500">Live from the task queue (tasks.db).</p>
            <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200">
              <table className="min-w-full divide-y divide-stone-200 text-sm">
                <thead className="bg-stone-50 text-left text-stone-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Request</th>
                    <th className="px-4 py-3 font-medium">Agent / Model</th>
                    <th className="px-4 py-3 font-medium">Stage</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {s.activeRequests.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-500">No active requests.</td></tr>
                  )}
                  {s.activeRequests.map((request) => (
                    <tr key={request.requestId}>
                      <td className="px-4 py-3 font-medium text-stone-900">{request.requestId}</td>
                      <td className="px-4 py-3">{request.model}</td>
                      <td className="px-4 py-3">{request.stage}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          request.status === 'running' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {request.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{request.durationSeconds}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Loaded in VRAM</h2>
              <p className="mt-1 text-sm text-stone-500">Live from Ollama /api/ps.</p>
              <div className="mt-4 space-y-3">
                {s.loadedModels.length === 0 && <p className="text-sm text-stone-500">No model currently resident.</p>}
                {s.loadedModels.map((m) => (
                  <div key={m.name} className="flex items-center justify-between rounded-2xl bg-stone-50 p-3 text-sm">
                    <span className="font-medium text-stone-800">{m.name}</span>
                    <span className="text-stone-600">{m.vramGb} GB</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Recent failures</h2>
              <div className="mt-4 space-y-3">
                {s.failures.length === 0 && <p className="text-sm text-stone-500">No recorded failures.</p>}
                {s.failures.map((item, i) => (
                  <div key={i} className="rounded-2xl bg-stone-50 p-3 text-sm">
                    <div className="font-medium text-stone-800">{item.reason}</div>
                    {item.task && <div className="text-stone-500">{item.task}</div>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Which models processed work?</h2>
            <p className="mt-1 text-sm text-stone-500">Measured Ollama timings from traces.jsonl (populates as generations run).</p>
            <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200">
              <table className="min-w-full divide-y divide-stone-200 text-sm">
                <thead className="bg-stone-50 text-left text-stone-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Runs</th>
                    <th className="px-4 py-3 font-medium">Tokens/sec</th>
                    <th className="px-4 py-3 font-medium">Avg load</th>
                    <th className="px-4 py-3 font-medium">Avg total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {s.models.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-500">No generations traced yet.</td></tr>
                  )}
                  {s.models.map((model) => (
                    <tr key={model.name}>
                      <td className="px-4 py-3 font-medium text-stone-900">{model.name}</td>
                      <td className="px-4 py-3">{model.requests}</td>
                      <td className="px-4 py-3">{model.outputTokensPerSecond}</td>
                      <td className="px-4 py-3">{model.avgLoadMs} ms</td>
                      <td className="px-4 py-3">{model.avgTotalMs} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Local vs cloud</h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-primary-50 p-4">
                <div className="text-sm text-primary-700">Local share of routed requests</div>
                <div className="mt-2 text-3xl font-semibold text-primary-900">
                  {s.engineSplit.localSharePct === null ? 'n/a' : `${s.engineSplit.localSharePct}%`}
                </div>
                <div className="mt-1 text-xs text-primary-700">
                  {s.engineSplit.localRequests} local · {s.engineSplit.cloudRequests} cloud
                </div>
              </div>
              <div className="rounded-2xl bg-stone-50 p-4">
                <div className="text-sm text-stone-600">Cloud budget</div>
                {s.budget ? (
                  <>
                    <div className="mt-2 text-3xl font-semibold text-stone-900">
                      ${s.budget.remainingUsd.toFixed(2)}
                    </div>
                    <div className="mt-1 text-xs text-stone-500">
                      spent ${s.budget.spentUsd.toFixed(2)} of ${s.budget.capUsd.toFixed(2)}
                    </div>
                  </>
                ) : (
                  <div className="mt-2 text-sm text-stone-500">Not tracked.</div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
