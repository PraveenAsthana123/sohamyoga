'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SetupField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'email';
  placeholder?: string;
  help?: string;
  required?: boolean;
}

interface SetupStep {
  id: string;
  platform: string;
  step_number: number;
  step_title: string;
  step_description: string;
  step_type: 'info' | 'form' | 'oauth' | 'verify' | 'copy_value' | 'open_url' | 'env_var';
  required_fields: SetupField[];
  action_url?: string;
  action_label?: string;
  env_var_to_set?: string;
  validation_hint?: string;
  is_completed: boolean;
  completed_at?: string;
}

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
  webhook_url?: string;
  notes?: string;
  last_tested_at?: string;
  test_result?: string;
  test_error?: string;
  setup_steps_completed: number;
  setup_steps_total: number;
}

interface SetupLog {
  id: string;
  platform: string;
  action: string;
  details: Record<string, unknown>;
  actor: string;
  created_at: string;
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

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  configured: 'bg-yellow-100 text-yellow-700',
  verified: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors">
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

function EnvVarBlock({ varName }: { varName: string }) {
  const exportLine = `export ${varName}="your-value-here"`;
  const envLine = `${varName}=your-value-here`;
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-medium text-gray-600 mb-1">Shell export:</div>
        <div className="flex items-center bg-gray-900 text-green-400 rounded-lg px-3 py-2 text-sm font-mono">
          <span className="flex-1">{exportLine}</span>
          <CopyButton text={exportLine} />
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-gray-600 mb-1">.env file format:</div>
        <div className="flex items-center bg-gray-900 text-green-400 rounded-lg px-3 py-2 text-sm font-mono">
          <span className="flex-1">{envLine}</span>
          <CopyButton text={envLine} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PlatformSetupPage({ params }: { params: Promise<{ platform: string }> }) {
  const { platform } = use(params);

  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [steps, setSteps] = useState<SetupStep[]>([]);
  const [logs, setLogs] = useState<SetupLog[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: Record<string, unknown> } | null>(null);
  const [error, setError] = useState('');

  // Form state
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showHide, setShowHide] = useState<Record<string, boolean>>({});
  const [envConfirmed, setEnvConfirmed] = useState<Record<string, boolean>>({});
  const [envCheckResult, setEnvCheckResult] = useState<Record<string, boolean | null>>({});
  const [urlOpened, setUrlOpened] = useState<Record<string, boolean>>({});
  const [stepDoneClicked, setStepDoneClicked] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/platform-credentials/${platform}`);
      if (!r.ok) {
        setError('Platform not found. Make sure you have seeded the platforms first.');
        setLoading(false);
        return;
      }
      const data = await r.json() as { config: PlatformConfig; steps: SetupStep[]; logs: SetupLog[] };
      setConfig(data.config);
      setSteps(data.steps);
      setLogs(data.logs);
      // Set current step to first incomplete
      const firstIncomplete = data.steps.findIndex(s => !s.is_completed);
      setCurrentStep(firstIncomplete >= 0 ? firstIncomplete : 0);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [platform]);

  useEffect(() => { void load(); }, [load]);

  const step = steps[currentStep];

  const markStepComplete = async (isCompleted = true, extraFormValues?: Record<string, string>) => {
    if (!step) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/platform-credentials/${platform}/steps/${step.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_completed: isCompleted,
          form_values: extraFormValues ?? (Object.keys(formValues).length > 0 ? formValues : undefined),
        }),
      });
      if (r.ok) {
        await load();
        if (isCompleted && currentStep < steps.length - 1) {
          setCurrentStep(prev => prev + 1);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await markStepComplete(true, formValues);
    setFormValues({});
  };

  const handleCheckEnv = async (varName: string) => {
    const r = await fetch(`/api/admin/platform-credentials/${platform}/check-env?var=${encodeURIComponent(varName)}`);
    const data = await r.json() as { set: boolean };
    setEnvCheckResult(prev => ({ ...prev, [varName]: data.set }));
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch(`/api/admin/platform-credentials/${platform}/test`, { method: 'POST' });
      const data = await r.json() as { success: boolean; message: string; details?: Record<string, unknown> };
      setTestResult(data);
      await load();
      if (data.success) {
        await markStepComplete(true);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleReset = async () => {
    if (!confirm(`Reset all setup progress for ${config?.display_name ?? platform}? This cannot be undone.`)) return;
    await fetch(`/api/admin/platform-credentials/${platform}/reset`, { method: 'POST' });
    await load();
    setCurrentStep(0);
    setFormValues({});
    setEnvConfirmed({});
    setTestResult(null);
  };

  const completedCount = steps.filter(s => s.is_completed).length;
  const progressPct = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;
  const isPostiz = config?.connector_type === 'postiz';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-3">⏳</div>
          <p>Loading {platform} setup...</p>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center">
          <div className="text-4xl mb-3">❌</div>
          <p className="text-red-800 mb-4">{error || 'Platform not found'}</p>
          <Link href="/admin/platform-credentials" className="text-indigo-600 hover:text-indigo-800">
            ← Back to All Platforms
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/platform-credentials" className="text-gray-400 hover:text-gray-600 text-sm">
              ← All Platforms
            </Link>
            <span className="text-gray-300">/</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{PLATFORM_EMOJIS[platform] ?? '🌐'}</span>
              <h1 className="text-xl font-bold text-gray-900">{config.display_name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[config.setup_status] ?? 'bg-gray-100 text-gray-600'}`}>
                {config.setup_status.replace('_', ' ')}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                {config.connector_type.replace('_', ' ')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500">{completedCount}/{steps.length} steps • {progressPct}%</div>
            <button
              onClick={handleReset}
              className="text-xs text-red-500 hover:text-red-700 underline"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Sidebar — Step List */}
        <div className="w-72 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
          <div className="p-4">
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{progressPct}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {steps.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrentStep(idx)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                  idx === currentStep ? 'bg-indigo-50 border-r-2 border-indigo-600' : 'hover:bg-gray-50'
                }`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                  s.is_completed
                    ? 'bg-green-500 text-white'
                    : idx === currentStep
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {s.is_completed ? '✓' : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${idx === currentStep ? 'text-indigo-700' : 'text-gray-700'}`}>
                    {s.step_title}
                  </div>
                  <div className="text-xs text-gray-400 capitalize">{s.step_type}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Recent Logs */}
          {logs.length > 0 && (
            <div className="p-4 border-t border-gray-100">
              <div className="text-xs font-medium text-gray-500 mb-2">Recent Activity</div>
              <div className="space-y-1">
                {logs.slice(0, 5).map(log => (
                  <div key={log.id} className="text-xs text-gray-400">
                    <span className="capitalize">{log.action.replace('_', ' ')}</span>
                    <span className="block text-gray-300">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6">
            {/* Postiz Notice */}
            {isPostiz && (
              <div className="mb-6 rounded-xl bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🔗</span>
                  <div>
                    <p className="font-semibold text-blue-900 text-sm">This platform connects via Postiz</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Set up your Postiz account credentials first (<code className="bg-blue-100 px-1 rounded">POSTIZ_PUBLIC_API_KEY</code>),
                      then connect this platform&apos;s account inside the Postiz dashboard. Once connected in Postiz, posting via our platform will work automatically.
                    </p>
                    <a
                      href="https://postiz.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-700 hover:text-blue-900 bg-blue-100 rounded px-2 py-1"
                    >
                      Open Postiz Dashboard →
                    </a>
                  </div>
                </div>
              </div>
            )}

            {step ? (
              <div>
                {/* Step Header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                    <span>Step {step.step_number} of {steps.length}</span>
                    <span>•</span>
                    <span className="capitalize">{step.step_type}</span>
                    {step.is_completed && <span className="text-green-600 font-medium">• Completed ✓</span>}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{step.step_title}</h2>
                </div>

                {/* STEP TYPE: INFO */}
                {step.step_type === 'info' && (
                  <div className="rounded-xl bg-blue-50 border border-blue-200 p-5 mb-6">
                    <p className="text-blue-800 text-sm leading-relaxed">{step.step_description}</p>
                  </div>
                )}

                {/* STEP TYPE: OPEN_URL */}
                {step.step_type === 'open_url' && (
                  <div className="space-y-4 mb-6">
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-5">
                      <p className="text-gray-700 text-sm leading-relaxed mb-4">{step.step_description}</p>
                      {step.action_url && (
                        <a
                          href={step.action_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setUrlOpened(prev => ({ ...prev, [step.id]: true }))}
                          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                        >
                          🌐 {step.action_label ?? 'Open Page'}
                          <span className="text-indigo-200 text-xs">↗</span>
                        </a>
                      )}
                    </div>
                    {urlOpened[step.id] && (
                      <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                        Page opened. Complete the required action, then mark this step as done.
                      </div>
                    )}
                  </div>
                )}

                {/* STEP TYPE: FORM */}
                {step.step_type === 'form' && (
                  <div className="mb-6">
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-5 mb-4">
                      <p className="text-gray-700 text-sm mb-4">{step.step_description}</p>
                    </div>
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                      {step.required_fields?.map(field => (
                        <div key={field.name}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <div className="relative">
                            <input
                              type={field.type === 'password' && !showHide[field.name] ? 'password' : field.type === 'password' ? 'text' : field.type}
                              placeholder={field.placeholder}
                              required={field.required}
                              value={formValues[field.name] ?? ''}
                              onChange={e => setFormValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                            />
                            {field.type === 'password' && (
                              <button
                                type="button"
                                onClick={() => setShowHide(prev => ({ ...prev, [field.name]: !prev[field.name] }))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                              >
                                {showHide[field.name] ? '🙈' : '👁️'}
                              </button>
                            )}
                          </div>
                          {field.help && <p className="text-xs text-gray-500 mt-1">{field.help}</p>}
                        </div>
                      ))}
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save & Continue →'}
                      </button>
                    </form>
                    {step.env_var_to_set && (
                      <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                        <strong>Note:</strong> The non-secret values (App ID, App Name) will be saved to the database. The actual secret ({step.env_var_to_set}) must be stored in your .env file only.
                      </div>
                    )}
                  </div>
                )}

                {/* STEP TYPE: ENV_VAR */}
                {step.step_type === 'env_var' && step.env_var_to_set && (
                  <div className="mb-6 space-y-4">
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-5">
                      <p className="text-gray-700 text-sm leading-relaxed mb-4">{step.step_description}</p>
                      <EnvVarBlock varName={step.env_var_to_set} />
                    </div>

                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                      <strong>Security:</strong> We never store secret values in the database. Copy the value to your <code className="bg-amber-100 px-1 rounded">.env</code> file and restart the server.
                    </div>

                    {/* Check if env var is set */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleCheckEnv(step.env_var_to_set!)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        Check if {step.env_var_to_set} is set on server
                      </button>
                      {envCheckResult[step.env_var_to_set] === true && (
                        <span className="text-xs text-green-600 font-medium">✓ Set on server</span>
                      )}
                      {envCheckResult[step.env_var_to_set] === false && (
                        <span className="text-xs text-red-600 font-medium">✗ Not set — check your .env file</span>
                      )}
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={envConfirmed[step.env_var_to_set] ?? false}
                        onChange={e => setEnvConfirmed(prev => ({ ...prev, [step.env_var_to_set!]: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600"
                      />
                      <span className="text-sm text-gray-700">
                        I have added <code className="bg-gray-100 px-1 rounded">{step.env_var_to_set}</code> to my .env file and restarted the server
                      </span>
                    </label>

                    {envConfirmed[step.env_var_to_set] && (
                      <button
                        onClick={() => markStepComplete(true)}
                        disabled={saving}
                        className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : '✓ Mark as Set & Continue →'}
                      </button>
                    )}
                  </div>
                )}

                {/* STEP TYPE: VERIFY */}
                {step.step_type === 'verify' && (
                  <div className="mb-6 space-y-4">
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-5">
                      <p className="text-gray-700 text-sm mb-4">{step.step_description}</p>
                      {step.validation_hint && (
                        <p className="text-xs text-gray-500 italic">Expected: {step.validation_hint}</p>
                      )}
                    </div>

                    <button
                      onClick={handleTest}
                      disabled={testing}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {testing ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Testing Connection...
                        </>
                      ) : '🔌 Test Connection'}
                    </button>

                    {testResult && (
                      <div className={`rounded-xl p-4 border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className={`font-medium text-sm mb-1 ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                          {testResult.success ? '✅ Connection Verified!' : '❌ Connection Failed'}
                        </div>
                        <p className={`text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>{testResult.message}</p>
                        {testResult.details && !testResult.success && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 cursor-pointer">Technical details</summary>
                            <pre className="text-xs mt-1 text-gray-600 whitespace-pre-wrap">{JSON.stringify(testResult.details, null, 2)}</pre>
                          </details>
                        )}
                        {!testResult.success && (
                          <div className="mt-3 text-xs text-red-600">
                            <strong>Troubleshooting:</strong>
                            <ul className="list-disc ml-4 mt-1 space-y-1">
                              <li>Check that all env vars from previous steps are set correctly in .env</li>
                              <li>Restart the Next.js server after changing .env</li>
                              <li>Verify the credentials on the platform&apos;s developer portal</li>
                              <li>Check that API scopes/permissions are correctly configured</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* info / open_url mark done button */}
                {(step.step_type === 'info' || step.step_type === 'open_url') && !step.is_completed && (
                  <button
                    onClick={() => {
                      setStepDoneClicked(prev => ({ ...prev, [step.id]: true }));
                      void markStepComplete(true);
                    }}
                    disabled={saving || stepDoneClicked[step.id]}
                    className="w-full rounded-lg border-2 border-indigo-600 text-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-50 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving...' : step.is_completed ? '✓ Completed' : "✓ I've completed this step"}
                  </button>
                )}

                {step.is_completed && step.step_type !== 'verify' && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                    ✅ This step is marked as complete. You can redo it or continue to the next step.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-3">📋</div>
                <p>No steps found for this platform. Try seeding first.</p>
                <Link href="/admin/platform-credentials" className="text-indigo-600 hover:text-indigo-800 text-sm mt-4 block">
                  ← Back to All Platforms
                </Link>
              </div>
            )}

            {/* Navigation */}
            {steps.length > 0 && (
              <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
                <button
                  onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                  disabled={currentStep === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                >
                  ← Previous Step
                </button>
                <div className="text-sm text-gray-400">
                  Step {currentStep + 1} of {steps.length}
                </div>
                <button
                  onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
                  disabled={currentStep === steps.length - 1}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                >
                  Next Step →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
