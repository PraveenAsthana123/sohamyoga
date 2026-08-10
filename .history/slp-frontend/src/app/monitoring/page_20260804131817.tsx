import Link from 'next/link';
import { getMonitoringSnapshot } from '@/lib/monitoring';

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function Gauge({ value, label }: { value: number; label: string }) {
  const width = Math.min(value, 100);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-stone-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-stone-900">{value}%</div>
      <div className="mt-3 h-2 rounded-full bg-stone-100">
        <div className="h-2 rounded-full bg-primary-600" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default async function MonitoringPage() {
  const snapshot = await getMonitoringSnapshot();

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-24 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-stone-200 bg-gradient-to-br from-primary-700 to-primary-900 p-8 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-primary-100">Operational dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Local AI operations for documents and code</h1>
              <p className="mt-3 max-w-3xl text-sm text-primary-100 sm:text-base">
                This view answers five questions: what is running, which model is active, why a request is slow or failing, whether the output passed validation, and how much cloud usage Ollama avoided.
              </p>
            </div>
            <Link href="/" className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/25">
              Back to home
            </Link>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <div className="text-sm text-primary-100">Running requests</div>
              <div className="mt-2 text-3xl font-semibold">{snapshot.summary.running}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <div className="text-sm text-primary-100">Model in use</div>
              <div className="mt-2 text-xl font-semibold">{snapshot.summary.modelInUse}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <div className="text-sm text-primary-100">Slow / stalled</div>
              <div className="mt-2 text-3xl font-semibold">{snapshot.summary.slow}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <div className="text-sm text-primary-100">Failing</div>
              <div className="mt-2 text-3xl font-semibold">{snapshot.summary.failing}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <div className="text-sm text-primary-100">Cloud tokens saved</div>
              <div className="mt-2 text-3xl font-semibold">{formatNumber(snapshot.cloudSavings.tokensSaved)}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">What requests are running?</h2>
            <p className="mt-1 text-sm text-stone-500">Live queue and work-in-progress view.</p>
            <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200">
              <table className="min-w-full divide-y divide-stone-200 text-sm">
                <thead className="bg-stone-50 text-left text-stone-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Request ID</th>
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Stage</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {snapshot.activeRequests.map((request) => (
                    <tr key={request.requestId}>
                      <td className="px-4 py-3 font-medium text-stone-900">{request.requestId}</td>
                      <td className="px-4 py-3">{request.model}</td>
                      <td className="px-4 py-3">{request.stage}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          request.status === 'running'
                            ? 'bg-emerald-100 text-emerald-700'
                            : request.status === 'queued'
                              ? 'bg-amber-100 text-amber-700'
                              : request.status === 'stalled'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-rose-100 text-rose-700'
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
              <h2 className="text-xl font-semibold">Why is a request slow or failing?</h2>
              <div className="mt-4 space-y-3">
                {snapshot.failureBreakdown.map((item) => (
                  <div key={item.reason} className="rounded-2xl bg-stone-50 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-stone-800">{item.reason}</span>
                      <span className="text-stone-600">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Is the result good enough?</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Gauge value={snapshot.quality.validationPassRate} label="Validation pass" />
                <Gauge value={snapshot.quality.humanAcceptanceRate} label="Human acceptance" />
                <Gauge value={snapshot.summary.qualityScore} label="Quality score" />
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Which model is processing them?</h2>
            <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200">
              <table className="min-w-full divide-y divide-stone-200 text-sm">
                <thead className="bg-stone-50 text-left text-stone-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Requests</th>
                    <th className="px-4 py-3 font-medium">Latency</th>
                    <th className="px-4 py-3 font-medium">First token</th>
                    <th className="px-4 py-3 font-medium">Success</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {snapshot.models.map((model) => (
                    <tr key={model.name}>
                      <td className="px-4 py-3 font-medium text-stone-900">{model.name}</td>
                      <td className="px-4 py-3">{model.requests}</td>
                      <td className="px-4 py-3">{model.latencyMs} ms</td>
                      <td className="px-4 py-3">{model.firstTokenMs} ms</td>
                      <td className="px-4 py-3">{model.successRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">How much Claude/Codex usage did Ollama save?</h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-primary-50 p-4">
                <div className="text-sm text-primary-700">Tokens avoided</div>
                <div className="mt-2 text-3xl font-semibold text-primary-900">{formatNumber(snapshot.cloudSavings.tokensSaved)}</div>
              </div>
              <div className="rounded-2xl bg-stone-50 p-4">
                <div className="text-sm text-stone-600">Local share of successful work</div>
                <div className="mt-2 text-3xl font-semibold text-stone-900">{snapshot.cloudSavings.localShare}%</div>
              </div>
              <div className="rounded-2xl bg-stone-50 p-4">
                <div className="text-sm text-stone-600">Accepted savings</div>
                <div className="mt-2 text-3xl font-semibold text-stone-900">{snapshot.cloudSavings.acceptedSavings}%</div>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <h3 className="font-semibold text-stone-900">Recommended actions</h3>
              <ul className="mt-3 space-y-2 text-sm text-stone-700">
                {snapshot.recommendations.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
