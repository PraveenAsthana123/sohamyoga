'use client';

import { useState, useEffect, useCallback } from 'react';

interface Template {
  template_id: string; name: string; agent_class: string; tools: string;
  base_model: string; auto_test: boolean; created_at: string;
}
interface BuildJob {
  job_id: string; template_id: string; template_name: string;
  priority: string; status: string; queued_at: string; estimated_completion: string;
}
interface PipelineStage {
  id: number; job_id: string; stage_name: string;
  status: string; duration_s: number | null; log_snippet: string | null;
}
interface RegistryEntry {
  agent_id: string; name: string; version: string; build_number: number;
  template_id: string; template_name: string; deployed_to: string; built_at: string;
}
interface Stats { templates: number; builtThisWeek: number; autoDeployPct: number; avgBuildTimeS: number; }

type Tab = 'floor' | 'templates' | 'queue' | 'pipeline' | 'registry';

const JOB_STATUS_COLOR: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-600', running: 'bg-blue-100 text-blue-700',
  passed: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-600',
};
const STAGE_STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-500', running: 'bg-blue-100 text-blue-700',
  passed: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-600',
};
const STAGE_ICONS: Record<string, string> = {
  Design: '📐', Configure: '⚙️', Test: '🧪', Package: '📦', Deploy: '🚀',
};
const PRIORITY_COLOR: Record<string, string> = {
  high: 'bg-red-100 text-red-700', normal: 'bg-blue-100 text-blue-700',
  low: 'bg-gray-100 text-gray-600',
};

export default function AgentFactoryPage() {
  const [tab, setTab] = useState<Tab>('floor');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [queue, setQueue] = useState<BuildJob[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [registry, setRegistry] = useState<RegistryEntry[]>([]);
  const [stats, setStats] = useState<Stats>({ templates: 0, builtThisWeek: 0, autoDeployPct: 0, avgBuildTimeS: 0 });
  const [selectedJob, setSelectedJob] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agent-factory');
      if (!res.ok) return;
      const d = await res.json();
      setTemplates(d.templates || []);
      setQueue(d.queue || []);
      setStages(d.stages || []);
      setRegistry(d.registry || []);
      setStats(d.stats || {});
      if (!selectedJob && d.queue?.length) setSelectedJob(d.queue[0].job_id);
    } finally {
      setLoading(false);
    }
  }, [selectedJob]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'floor', label: 'Factory Floor' },
    { key: 'templates', label: 'Templates' },
    { key: 'queue', label: 'Build Queue' },
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'registry', label: 'Registry' },
  ];

  const stagesForJob = stages.filter(s => s.job_id === (selectedJob || queue[0]?.job_id));
  const jobProgress = queue.map(job => {
    const jobStages = stages.filter(s => s.job_id === job.job_id);
    const total = jobStages.length;
    const done = jobStages.filter(s => s.status === 'passed').length;
    const running = jobStages.findIndex(s => s.status === 'running');
    const currentStage = running >= 0 ? jobStages[running].stage_name : (done === total && total > 0 ? 'Done' : 'Queued');
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { ...job, currentStage, pct };
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agent Factory</h1>
        <p className="text-gray-500 text-sm mt-1">Build, test, package and deploy AI agents from templates</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Templates', value: stats.templates, color: 'text-indigo-600' },
          { label: 'Built This Week', value: stats.builtThisWeek, color: 'text-green-600' },
          { label: 'Auto-Deploy %', value: `${stats.autoDeployPct}%`, color: 'text-blue-600' },
          { label: 'Avg Build Time', value: `${stats.avgBuildTimeS}s`, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Factory Floor */}
      {tab === 'floor' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Active Builds</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Agent / Template','Stage','Progress %','ETA','Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobProgress.map(job => (
                <tr key={job.job_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{job.template_name}</div>
                    <div className="text-xs text-gray-400">{job.job_id}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-700">
                    {STAGE_ICONS[job.currentStage] || '▶'} {job.currentStage}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-24">
                        <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${job.pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-600 w-8">{job.pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {job.estimated_completion ? new Date(job.estimated_completion).toLocaleTimeString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${JOB_STATUS_COLOR[job.status] || 'bg-gray-100 text-gray-600'}`}>
                      {job.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Templates */}
      {tab === 'templates' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Agent Templates</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Template','Agent Class','Tools','Base Model','Auto Test',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map(t => (
                <tr key={t.template_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.template_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">{t.agent_class}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                    <div className="flex flex-wrap gap-1">
                      {(t.tools || '').split(',').map(tool => (
                        <span key={tool} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{tool.trim()}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 font-mono">{t.base_model}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block w-2 h-2 rounded-full ${t.auto_test ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-xs px-3 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 transition-colors">
                      Clone
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Build Queue */}
      {tab === 'queue' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Build Queue</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Job ID','Template','Priority','Status','Queued At','ETA'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {queue.map(job => (
                <tr key={job.job_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{job.job_id}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{job.template_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLOR[job.priority] || 'bg-gray-100 text-gray-600'}`}>
                      {job.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${JOB_STATUS_COLOR[job.status] || 'bg-gray-100 text-gray-600'}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(job.queued_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {job.estimated_completion ? new Date(job.estimated_completion).toLocaleTimeString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pipeline */}
      {tab === 'pipeline' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {queue.map(job => (
              <button key={job.job_id} onClick={() => setSelectedJob(job.job_id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedJob === job.job_id ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                {job.job_id}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-800">Pipeline: {selectedJob}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {stagesForJob.map(stage => (
                <div key={stage.id} className="px-5 py-4 flex items-start gap-4">
                  <div className="mt-0.5 text-xl">{STAGE_ICONS[stage.stage_name] || '▶'}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium text-gray-800">{stage.stage_name}</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STAGE_STATUS_COLOR[stage.status] || 'bg-gray-100 text-gray-600'}`}>
                        {stage.status}
                      </span>
                      {stage.duration_s !== null && (
                        <span className="text-xs text-gray-400">{stage.duration_s}s</span>
                      )}
                    </div>
                    {stage.log_snippet && (
                      <pre className="text-xs text-gray-600 bg-gray-50 rounded p-2 font-mono whitespace-pre-wrap">{stage.log_snippet}</pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Registry */}
      {tab === 'registry' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Agent Registry</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Agent','Version','Build #','Template','Deployed To','Built At'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {registry.map(r => (
                <tr key={r.agent_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{r.name}</div>
                    <div className="text-xs text-gray-400">{r.agent_id}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-indigo-600">{r.version}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">#{r.build_number}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{r.template_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.deployed_to === 'production' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {r.deployed_to}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.built_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
