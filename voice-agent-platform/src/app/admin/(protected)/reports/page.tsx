import { submissionConversionByForm } from '@/domain/form/repository';
import { scriptUsageCounts } from '@/domain/script/repository';
import { callsByStatus, callsPerDay, qualityMatrixByScript } from '@/domain/call/repository';
import { customerPreferenceReport } from '@/domain/contact/preferenceRepository';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const [conversion, usage, byStatus, perDay, quality, preferences] = await Promise.all([
    submissionConversionByForm(),
    scriptUsageCounts(),
    callsByStatus(),
    callsPerDay(30),
    qualityMatrixByScript(),
    customerPreferenceReport(),
  ]);

  const totalCalls = byStatus.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm opacity-60 mt-1">Real queries against the live database — empty tables mean genuinely no data yet.</p>
      </div>

      <div>
        <h2 className="font-medium mb-2">Form submission → contact conversion</h2>
        {conversion.length === 0 ? (
          <p className="text-sm opacity-60">No forms yet.</p>
        ) : (
          <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/10 text-left">
                <tr><th className="p-2">Form</th><th className="p-2">Submissions</th><th className="p-2">Converted to contact</th><th className="p-2">Conversion rate</th></tr>
              </thead>
              <tbody>
                {conversion.map((c) => (
                  <tr key={c.formId} className="border-t border-black/10 dark:border-white/10">
                    <td className="p-2">{c.formName}</td>
                    <td className="p-2">{c.submissionCount}</td>
                    <td className="p-2">{c.convertedToContact}</td>
                    <td className="p-2">{c.submissionCount > 0 ? `${Math.round((c.convertedToContact / c.submissionCount) * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-medium mb-2">Call script usage</h2>
        {usage.length === 0 ? (
          <p className="text-sm opacity-60">No call scripts yet.</p>
        ) : (
          <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/10 text-left">
                <tr><th className="p-2">Script</th><th className="p-2">Calls using it</th></tr>
              </thead>
              <tbody>
                {usage.map((u) => (
                  <tr key={u.scriptId} className="border-t border-black/10 dark:border-white/10">
                    <td className="p-2">{u.scriptName}</td>
                    <td className="p-2">{u.callCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-medium mb-2">Calls by status ({totalCalls} total)</h2>
        {byStatus.length === 0 ? (
          <p className="text-sm opacity-60">No calls logged yet.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {byStatus.map((s) => (
              <li key={s.status} className="flex justify-between max-w-xs">
                <span className="capitalize">{s.status.replace('_', ' ')}</span>
                <span className="font-medium">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="font-medium mb-2">Quality matrix (per-script, human QA review)</h2>
        <p className="text-xs opacity-50 mb-2">Average score is only from calls an admin has actually reviewed — never ML/sentiment-derived.</p>
        {quality.length === 0 ? (
          <p className="text-sm opacity-60">No calls logged yet.</p>
        ) : (
          <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-black/5 dark:bg-white/10 text-left">
                <tr><th className="p-2">Script</th><th className="p-2">Avg quality</th><th className="p-2">Incidents</th><th className="p-2">Total calls</th></tr>
              </thead>
              <tbody>
                {quality.map((q) => (
                  <tr key={q.scriptName ?? 'unassigned'} className="border-t border-black/10 dark:border-white/10">
                    <td className="p-2">{q.scriptName ?? '(no script)'}</td>
                    <td className="p-2">{q.avgQualityScore !== null ? `${q.avgQualityScore.toFixed(1)}/5` : 'not reviewed yet'}</td>
                    <td className={`p-2 ${q.incidentCount > 0 ? 'text-red-600 font-medium' : ''}`}>{q.incidentCount}</td>
                    <td className="p-2">{q.totalCalls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-medium mb-2">What customers want (needs/preference survey responses)</h2>
        <p className="text-xs opacity-50 mb-2">Admin-entered from real survey calls -- never transcript-parsed or estimated. Empty means nothing has been recorded yet.</p>
        {preferences.totalResponses === 0 ? (
          <p className="text-sm opacity-60">No survey responses recorded yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium mb-1">By style ({preferences.totalResponses} total responses)</h3>
              <ul className="text-sm space-y-1">
                {preferences.byStyle.map((s) => (
                  <li key={s.preferredStyle} className="flex justify-between max-w-xs"><span>{s.preferredStyle}</span><span className="font-medium">{s.count}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-1">By preferred time</h3>
              <ul className="text-sm space-y-1">
                {preferences.byTime.map((t) => (
                  <li key={t.preferredTime} className="flex justify-between max-w-xs capitalize"><span>{t.preferredTime}</span><span className="font-medium">{t.count}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-1">By experience level</h3>
              <ul className="text-sm space-y-1">
                {preferences.byExperienceLevel.map((l) => (
                  <li key={l.experienceLevel} className="flex justify-between max-w-xs capitalize"><span>{l.experienceLevel}</span><span className="font-medium">{l.count}</span></li>
                ))}
              </ul>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between max-w-xs"><span className="opacity-60">Avg budget</span><span className="font-medium">{preferences.avgBudget !== null ? `$${preferences.avgBudget.toFixed(2)}` : '—'}</span></div>
              <div className="flex justify-between max-w-xs"><span className="opacity-60">Avg session length</span><span className="font-medium">{preferences.avgSessionLengthMinutes !== null ? `${Math.round(preferences.avgSessionLengthMinutes)} min` : '—'}</span></div>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-medium mb-2">Calls per day (last 30 days)</h2>
        {perDay.length === 0 ? (
          <p className="text-sm opacity-60">No calls logged yet.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {perDay.map((d) => (
              <li key={d.day} className="flex justify-between max-w-xs">
                <span>{d.day}</span>
                <span className="font-medium">{d.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
