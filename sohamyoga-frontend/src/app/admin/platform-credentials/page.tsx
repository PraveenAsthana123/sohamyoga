'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface PlatformConfig {
  id: string;
  platform: string;
  display_name: string;
  setup_status: string;
  connector_type: string;
  priority: string;
  required_env_vars: string[];
  optional_env_vars: string[];
  configured_env_vars: string[];
  developer_portal_url?: string;
  app_name?: string;
  app_id?: string;
  account_email?: string;
  last_tested_at?: string;
  test_result?: string;
  test_error?: string;
  setup_steps_completed: number;
  setup_steps_total: number;
  steps_completed_count?: number;
  steps_total_count?: number;
  notes?: string;
}

const PLATFORM_EMOJIS: Record<string, string> = {
  facebook: '📘', instagram: '📸', threads: '🧵', whatsapp_business: '💬',
  x_twitter: '🐦', linkedin: '💼', tiktok: '🎵', youtube: '▶️',
  pinterest: '📌', github: '🐙', gitlab: '🦊', google_business: '🗺️',
  telegram: '✈️', discord: '🎮', reddit: '🤖', trustpilot: '⭐',
  vimeo: '🎬', soundcloud: '🎧', patreon: '🎨', medium: '📝',
  google_ads: '🎯', snapchat: '👻', twitch: '📺', mastodon: '🐘',
  bluesky: '🦋', tumblr: '📓', dailymotion: '🎥', spotify: '🎵',
  apple_podcasts: '🎙️', yelp: '⭐', tripadvisor: '🏝️', quora: '❓',
  stack_overflow: '📚', substack: '📧', slack: '💬', dribbble: '🏀',
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  not_started: { label: 'Not Started', cls: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-100 text-blue-700 animate-pulse' },
  configured: { label: 'Configured', cls: 'bg-yellow-100 text-yellow-700' },
  verified: { label: 'Verified', cls: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', cls: 'bg-red-100 text-red-700' },
};

const PRIORITY_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  high: { label: 'High', cls: 'bg-red-100 text-red-700', dot: '🔴' },
  medium: { label: 'Medium', cls: 'bg-orange-100 text-orange-700', dot: '🟠' },
  low: { label: 'Low', cls: 'bg-yellow-100 text-yellow-700', dot: '🟡' },
};

const CONNECTOR_LABELS: Record<string, string> = {
  postiz: 'Postiz',
  custom_connector: 'Custom',
  manual_only: 'Manual',
};

type Tab = 'overview' | 'setup-guide' | 'credentials' | 'test-results';

export default function PlatformCredentialsPage() {
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [retestPlatform, setRetestPlatform] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/platform-credentials');
      const data = await r.json() as { platforms?: PlatformConfig[] };
      setPlatforms(data.platforms ?? []);
    } catch {
      setPlatforms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg('');
    try {
      const r = await fetch('/api/admin/platform-credentials/seed');
      const data = await r.json() as { message?: string };
      setSeedMsg(data.message ?? 'Done');
      await load();
    } catch (e) {
      setSeedMsg(`Error: ${String(e)}`);
    } finally {
      setSeeding(false);
    }
  };

  const handleRetest = async (platform: string) => {
    setRetestPlatform(platform);
    try {
      await fetch(`/api/admin/platform-credentials/${platform}/test`, { method: 'POST' });
      await load();
    } finally {
      setRetestPlatform(null);
    }
  };

  // Stats
  const total = platforms.length;
  const configured = platforms.filter(p => ['configured', 'verified'].includes(p.setup_status)).length;
  const verified = platforms.filter(p => p.test_result === 'pass').length;
  const pending = platforms.filter(p => p.setup_status === 'not_started').length;
  const pct = total > 0 ? Math.round((configured / total) * 100) : 0;

  // Group by connector type
  const byConnector: Record<string, PlatformConfig[]> = { postiz: [], custom_connector: [], manual_only: [] };
  platforms.forEach(p => {
    (byConnector[p.connector_type] = byConnector[p.connector_type] ?? []).push(p);
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'setup-guide', label: 'Setup Guide' },
    { id: 'credentials', label: 'Credentials' },
    { id: 'test-results', label: 'Test Results' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Developer Account Setup</h1>
          <p className="text-sm text-gray-500 mt-1">Configure real credentials for all 36 platforms. Secrets are stored in your .env file — never in the database.</p>
        </div>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {seeding ? 'Seeding...' : '🌱 Seed / Initialize Platforms'}
        </button>
      </div>

      {seedMsg && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">{seedMsg}</div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500">
          <div className="text-4xl mb-3">⏳</div>
          <p>Loading platforms...</p>
          {platforms.length === 0 && (
            <p className="mt-2 text-sm">No platforms found. Click &quot;Seed / Initialize Platforms&quot; to set up.</p>
          )}
        </div>
      ) : (
        <>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total Platforms', value: total, icon: '🌐', cls: 'bg-blue-50 border-blue-200' },
                  { label: 'Configured', value: configured, icon: '⚙️', cls: 'bg-yellow-50 border-yellow-200' },
                  { label: 'Verified', value: verified, icon: '✅', cls: 'bg-green-50 border-green-200' },
                  { label: 'Pending Setup', value: pending, icon: '🔲', cls: 'bg-gray-50 border-gray-200' },
                ].map(card => (
                  <div key={card.label} className={`rounded-xl border p-4 ${card.cls}`}>
                    <div className="text-2xl mb-1">{card.icon}</div>
                    <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                    <div className="text-sm text-gray-600">{card.label}</div>
                  </div>
                ))}
              </div>

              {/* Progress Bar */}
              <div className="mb-6 rounded-xl bg-white border border-gray-200 p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-gray-700">Overall Setup Progress</span>
                  <span className="text-gray-500">{configured}/{total} platforms configured ({pct}%)</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-green-500 transition-all duration-500 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Platform Grid by Connector Type */}
              {(['postiz', 'custom_connector', 'manual_only'] as const).map(ct => {
                const group = byConnector[ct] ?? [];
                if (group.length === 0) return null;
                return (
                  <div key={ct} className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      {ct === 'postiz' && '🔗 Postiz Connector'}
                      {ct === 'custom_connector' && '🔧 Custom Connector'}
                      {ct === 'manual_only' && '✋ Manual Setup'}
                      <span className="text-sm font-normal text-gray-500">({group.length} platforms)</span>
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {group.map(p => {
                        const status = STATUS_CONFIG[p.setup_status] ?? STATUS_CONFIG.not_started;
                        const priority = PRIORITY_CONFIG[p.priority] ?? PRIORITY_CONFIG.medium;
                        const stepsTotal = Number(p.steps_total_count ?? p.setup_steps_total ?? 0);
                        const stepsDone = Number(p.steps_completed_count ?? p.setup_steps_completed ?? 0);
                        const stepPct = stepsTotal > 0 ? Math.round((stepsDone / stepsTotal) * 100) : 0;

                        return (
                          <div key={p.platform} className="rounded-xl bg-white border border-gray-200 p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-2xl">{PLATFORM_EMOJIS[p.platform] ?? '🌐'}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>{status.label}</span>
                            </div>
                            <div className="font-medium text-gray-900 text-sm mb-1">{p.display_name}</div>
                            <div className="flex items-center gap-1 mb-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priority.cls}`}>
                                {priority.dot} {priority.label}
                              </span>
                            </div>
                            {stepsTotal > 0 && (
                              <div className="mb-3">
                                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-500 rounded-full transition-all"
                                    style={{ width: `${stepPct}%` }}
                                  />
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">{stepsDone}/{stepsTotal} steps</div>
                              </div>
                            )}
                            <Link
                              href={`/admin/platform-credentials/${p.platform}`}
                              className="block text-center text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 rounded-lg py-1.5 hover:bg-indigo-100 transition-colors"
                            >
                              Configure →
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {platforms.length === 0 && (
                <div className="rounded-xl bg-white border border-dashed border-gray-300 p-12 text-center">
                  <div className="text-4xl mb-3">🌱</div>
                  <p className="text-gray-600 mb-4">No platforms found. Initialize the platform list first.</p>
                  <button
                    onClick={handleSeed}
                    disabled={seeding}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {seeding ? 'Seeding...' : 'Initialize All 36 Platforms'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SETUP GUIDE TAB */}
          {activeTab === 'setup-guide' && (
            <div>
              <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h2 className="font-semibold text-gray-800">Setup Priority Guide</h2>
                  <p className="text-xs text-gray-500">Platforms ordered by business impact priority</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Priority</th>
                        <th className="px-4 py-3 text-left">Platform</th>
                        <th className="px-4 py-3 text-left">Connector</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Steps</th>
                        <th className="px-4 py-3 text-left">Env Vars Required</th>
                        <th className="px-4 py-3 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[...platforms]
                        .sort((a, b) => {
                          const order = { high: 1, medium: 2, low: 3 };
                          return (order[a.priority as keyof typeof order] ?? 3) - (order[b.priority as keyof typeof order] ?? 3);
                        })
                        .map(p => {
                          const status = STATUS_CONFIG[p.setup_status] ?? STATUS_CONFIG.not_started;
                          const priority = PRIORITY_CONFIG[p.priority] ?? PRIORITY_CONFIG.medium;
                          const stepsTotal = Number(p.steps_total_count ?? p.setup_steps_total ?? 0);
                          const stepsDone = Number(p.steps_completed_count ?? p.setup_steps_completed ?? 0);
                          return (
                            <tr key={p.platform} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${priority.cls}`}>
                                  {priority.dot} {priority.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span>{PLATFORM_EMOJIS[p.platform] ?? '🌐'}</span>
                                  <span className="font-medium text-gray-900">{p.display_name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                  {CONNECTOR_LABELS[p.connector_type] ?? p.connector_type}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${status.cls}`}>{status.label}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{stepsDone}/{stepsTotal}</td>
                              <td className="px-4 py-3 text-gray-500">{p.required_env_vars?.length ?? 0} required</td>
                              <td className="px-4 py-3">
                                <Link
                                  href={`/admin/platform-credentials/${p.platform}`}
                                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                                >
                                  {p.setup_status === 'not_started' ? 'Start Setup' : 'Continue →'}
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* CREDENTIALS TAB */}
          {activeTab === 'credentials' && (
            <div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-4 text-sm text-amber-800">
                <strong>Security Notice:</strong> Secret values (tokens, secrets, passwords) are stored in your <code className="bg-amber-100 px-1 rounded">.env</code> file and NEVER in the database. This table shows which env vars have been configured — not their values.
              </div>
              <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Platform</th>
                        <th className="px-4 py-3 text-left">Required Env Vars</th>
                        <th className="px-4 py-3 text-left">Confirmed Set</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {platforms.map(p => {
                        const confirmed = p.configured_env_vars ?? [];
                        const required = p.required_env_vars ?? [];
                        const allSet = required.length > 0 && required.every(v => confirmed.includes(v));
                        return (
                          <tr key={p.platform} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span>{PLATFORM_EMOJIS[p.platform] ?? '🌐'}</span>
                                <span className="font-medium text-gray-900">{p.display_name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {required.map(v => (
                                  <span key={v} className={`text-xs px-1.5 py-0.5 rounded font-mono ${confirmed.includes(v) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {v}
                                  </span>
                                ))}
                                {required.length === 0 && <span className="text-gray-400 text-xs">None required</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {confirmed.length}/{required.length}
                            </td>
                            <td className="px-4 py-3">
                              {allSet ? (
                                <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">All Set</span>
                              ) : required.length === 0 ? (
                                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">N/A</span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">Incomplete</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Link href={`/admin/platform-credentials/${p.platform}`} className="text-xs text-indigo-600 hover:text-indigo-800">
                                Configure →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TEST RESULTS TAB */}
          {activeTab === 'test-results' && (
            <div>
              <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Platform</th>
                        <th className="px-4 py-3 text-left">Last Tested</th>
                        <th className="px-4 py-3 text-left">Result</th>
                        <th className="px-4 py-3 text-left">Error / Info</th>
                        <th className="px-4 py-3 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {platforms.map(p => (
                        <tr key={p.platform} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span>{PLATFORM_EMOJIS[p.platform] ?? '🌐'}</span>
                              <span className="font-medium text-gray-900">{p.display_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {p.last_tested_at
                              ? new Date(p.last_tested_at).toLocaleString()
                              : <span className="text-gray-300">Never</span>}
                          </td>
                          <td className="px-4 py-3">
                            {p.test_result === 'pass' && <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">✅ Pass</span>}
                            {p.test_result === 'fail' && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">❌ Fail</span>}
                            {(!p.test_result || p.test_result === 'pending') && <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">Pending</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                            {p.test_error || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleRetest(p.platform)}
                              disabled={retestPlatform === p.platform}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                            >
                              {retestPlatform === p.platform ? 'Testing...' : 'Re-test'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
