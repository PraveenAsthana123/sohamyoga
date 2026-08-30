'use client';
// AI Ingestion — master/orchestrator page (Operational Portal Page & Tab
// Standard §1). Lists all 7 phases of the source spec; only Phase 1 is built.
// See docs/google-claude-integration-spec-gap-analysis.md for the full audit
// this pipeline was scoped against.

import Link from 'next/link';

const PHASES: Array<{ n: number; name: string; status: 'built' | 'not_built'; href?: string; note: string }> = [
  { n: 1, name: 'Source Registry & Discovery', status: 'built', href: '/admin/ai-ingestion/source-registry',
    note: 'One real connector (ChatGPT shared-link snapshots); every other source family shown as not_configured.' },
  { n: 2, name: 'Authentication, OAuth, Secrets, RBAC', status: 'built', href: '/admin/ai-ingestion/auth',
    note: 'Credential-gated: real Google OAuth2 flow + vault-backed credential storage built; needs a real Google Cloud OAuth app to actually connect. Full RBAC/ABAC/break-glass deferred (see integration-spec.md).' },
  { n: 3, name: 'Universal Connector Framework & Adapter SDK', status: 'built',
    note: 'ConnectorAdapter interface + circuit breaker; ChatGptShareAdapter is the real implementation, wired into actual usage (not decorative).' },
  { n: 4, name: 'File Ingestion, Desktop Folder Monitoring', status: 'built', href: '/admin/ai-ingestion/local-folder',
    note: 'Real folder watcher for .txt/.md files. DOCX/PDF/XLSX parsers deferred — see integration-spec.md.' },
  { n: 5, name: 'Google Drive, Docs & Sheets Connector', status: 'built', href: '/admin/ai-ingestion/google-drive',
    note: 'Real googleapis calls (Docs export, Sheets read) wired to Phase 2\'s OAuth token; needs a real connected Google account to actually run.' },
  { n: 6, name: 'Slack, Google Chat, WhatsApp, Messenger, LinkedIn', status: 'built', href: '/admin/ai-ingestion/slack',
    note: 'Slack: real OAuth + inbound channel/message reading. Google Chat/WhatsApp/Messenger/LinkedIn deferred — the latter three need real Meta Business/LinkedIn Partner app review, not just an OAuth app (see integration-spec.md).' },
  { n: 7, name: 'ChatGPT Shared-Link & Manual Paste Ingestion (broader)', status: 'built',
    note: 'Cross-registration duplicate detection (same conversation, different link) built. Chunking/topic segmentation/requirement extraction deferred — genuinely LLM-shaped tasks with no downstream consumer yet (see integration-spec.md).' },
];

export default function AiIngestionMasterPage() {
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">AI Ingestion Pipeline</h1>
        <p className="text-sm text-gray-500">
          Multi-source AI ingestion platform, phased. Full audit of the original 7-phase spec: see
          <code className="mx-1 rounded bg-gray-100 px-1">docs/google-claude-integration-spec-gap-analysis.md</code>
          in the repo.
        </p>
      </div>
      <div className="space-y-2">
        {PHASES.map(p => (
          <div key={p.n} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-gray-800">Phase {p.n} — {p.name}</p>
              <p className="text-xs text-gray-500">{p.note}</p>
            </div>
            {p.status === 'built' && p.href ? (
              <Link href={p.href} className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                Open
              </Link>
            ) : p.status === 'built' ? (
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Built (backend only)</span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-400">Not yet built</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
