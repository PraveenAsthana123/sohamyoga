import { vapiApiHealthLast7Days } from '@/domain/call/repository';
import { vapiSyncHealthLast7Days } from '@/domain/script/repository';
import { callsByStatus, totalCallCostUsd } from '@/domain/call/repository';
import InboundRoutingWidget from './InboundRoutingWidget';

export const dynamic = 'force-dynamic';

function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : '—';
}

function HealthCard({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const color = tone === 'bad' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : '';
  return (
    <div className="border border-black/10 dark:border-white/10 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide opacity-60">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

/**
 * Real "Voice AI Admin/Operations Control Tower" (Topic K) + "Non-Functional
 * Requirements reporting" (Topic L), scoped honestly: every number here is
 * derived from a table this app already writes to (vapi_api_audit_log,
 * vapi_sync_log, call_log). No fabricated SLA/uptime percentages, no
 * external monitoring integration -- this IS the monitoring, built from
 * what this app can actually observe about itself.
 */
export default async function OpsHealthPage() {
  const [apiHealth, syncHealth, byStatus, totalCost] = await Promise.all([
    vapiApiHealthLast7Days(),
    vapiSyncHealthLast7Days(),
    callsByStatus(),
    totalCallCostUsd(),
  ]);

  const totalCalls = byStatus.reduce((sum, s) => sum + s.count, 0);
  const failedOrNoAnswer = byStatus.filter((s) => s.status === 'failed' || s.status === 'no_answer').reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Ops Health</h1>
        <p className="text-sm opacity-60 mt-1">
          Every number below comes from this app&apos;s own audit tables (vapi_api_audit_log, vapi_sync_log, call_log) —
          not a third-party monitoring integration, and not an estimate.
        </p>
      </div>

      <div>
        <h2 className="font-medium mb-2">Vapi API health (last 7 days)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <HealthCard label="Total API calls" value={String(apiHealth.totalCalls)} />
          <HealthCard label="Success rate" value={pct(apiHealth.successCount, apiHealth.totalCalls)} tone={apiHealth.totalCalls > 0 && apiHealth.failureCount > 0 ? 'warn' : 'ok'} />
          <HealthCard
            label="Blocked (tenant isolation)"
            value={String(apiHealth.blockedCount)}
            tone={apiHealth.blockedCount > 0 ? 'bad' : 'ok'}
          />
          <HealthCard label="Avg latency" value={apiHealth.avgDurationMs !== null ? `${Math.round(apiHealth.avgDurationMs)}ms` : '—'} />
        </div>
        {apiHealth.blockedCount > 0 && (
          <p className="text-xs text-red-600 mt-2">
            A blocked count above zero means the VapiClient tenant-isolation guard actually refused a request targeting
            an assistant this app doesn&apos;t own — investigate immediately, this should never happen in normal operation.
          </p>
        )}
      </div>

      <div>
        <h2 className="font-medium mb-2">Vapi assistant sync health (last 7 days)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <HealthCard label="Sync attempts" value={String(syncHealth.totalAttempts)} />
          <HealthCard label="Sync success rate" value={pct(syncHealth.successCount, syncHealth.totalAttempts)} />
          <HealthCard label="Sync failures" value={String(syncHealth.failureCount)} tone={syncHealth.failureCount > 0 ? 'warn' : 'ok'} />
        </div>
      </div>

      <InboundRoutingWidget />

      <div>
        <h2 className="font-medium mb-2">Call outcomes (all time)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <HealthCard label="Total calls" value={String(totalCalls)} />
          <HealthCard label="Failed / no-answer rate" value={pct(failedOrNoAnswer, totalCalls)} tone={failedOrNoAnswer > 0 ? 'warn' : 'ok'} />
          <HealthCard label="Total Vapi cost" value={`$${totalCost.toFixed(2)}`} />
        </div>
      </div>
    </div>
  );
}
