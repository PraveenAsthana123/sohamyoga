// WebLLMAgentPanel — operator UI for §91 WebLLM + CDP + RAG + LangGraph agent.
//
// Per docs/WEBLLM_CDP_RAG_LANGGRAPH_INTEGRATION.md and global §91.
// Composes useWebLLM (browser-native inference via WebGPU) + useCDPSession
// (WebSocket bridge to backend LangGraph DAG). The browser-side WebLLM is
// the inference target — backend just orchestrates CDP + RAG + agent flow.

import { useEffect, useState } from 'react';
import { useWebLLM } from '../../hooks/useWebLLM';
import { useCDPSession } from '../../hooks/useCDPSession';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

export function WebLLMAgentPanel() {
  const { engine, loading, progress, error: webllmError, prompt: webllmPrompt } = useWebLLM();
  const { ws, connected, runAgent } = useCDPSession(API_BASE);

  const [goal, setGoal] = useState('');
  const [url, setUrl] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [auditFeed, setAuditFeed] = useState([]);

  // Bridge backend prompt requests → WebLLM inference → reply
  useEffect(() => {
    if (!ws || !engine) return;
    const onMessage = async (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type === 'prompt') {
        try {
          const reply = await webllmPrompt(msg.text, msg.max_tokens || 512);
          ws.send(JSON.stringify({ type: 'response', req_id: msg.req_id, text: reply }));
        } catch (e) {
          ws.send(JSON.stringify({
            type: 'response',
            req_id: msg.req_id,
            text: `[WebLLM error: ${e?.message || String(e)}]`,
          }));
        }
      }
    };
    ws.addEventListener('message', onMessage);
    return () => ws.removeEventListener('message', onMessage);
  }, [ws, engine, webllmPrompt]);

  const onRun = async () => {
    if (!goal.trim() || !url.trim()) {
      setError('Goal and URL required.');
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    setAuditFeed([]);
    try {
      const r = await runAgent(goal, url);
      setResult(r);
      setAuditFeed(r?.audit_log || []);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setRunning(false);
    }
  };

  const webllmReady = !loading && !!engine && !webllmError;
  const canRun = webllmReady && connected && !running;

  return (
    <div data-testid="webllm-agent-panel" style={{
      padding: 16,
      border: '1px solid var(--border-color, #e2e8f0)',
      borderRadius: 8,
      background: 'var(--surface, #fff)',
      maxWidth: 900,
    }}>
      <header style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>WebLLM + CDP + RAG + LangGraph Agent</h3>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
          Per §91. Browser-native inference (WebGPU) + headless Chrome + Chroma RAG + LangGraph DAG.
        </p>
      </header>

      {/* Status grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        <StatusPill
          label="WebLLM (in-browser)"
          ok={webllmReady}
          detail={loading ? `Loading ${Math.round(progress * 100)}%` : webllmError || (engine ? 'Ready' : 'Idle')}
          testid="webllm-status"
        />
        <StatusPill
          label="CDP WebSocket"
          ok={connected}
          detail={connected ? 'Connected' : 'Disconnected'}
          testid="cdp-status"
        />
        <StatusPill
          label="LangGraph + RAG"
          ok={true}
          detail="Backend"
          testid="langgraph-status"
        />
      </div>

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        <label style={{ fontSize: 13 }}>
          Goal
          <input
            data-testid="agent-goal-input"
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Validate this claim against the policy and recommend next action"
            style={{ width: '100%', padding: 8, fontSize: 13 }}
          />
        </label>
        <label style={{ fontSize: 13 }}>
          Target URL
          <input
            data-testid="agent-url-input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.carrier.com/claim/12345"
            style={{ width: '100%', padding: 8, fontSize: 13 }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            data-testid="agent-run-btn"
            disabled={!canRun}
            onClick={onRun}
            style={{
              background: canRun ? '#1e40af' : '#94a3b8',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: canRun ? 'pointer' : 'not-allowed',
            }}
          >
            {running ? 'Running...' : 'Run agent'}
          </button>
          {!webllmReady && !loading && (
            <small style={{ color: '#dc2626' }}>WebLLM not ready · install @mlc-ai/web-llm + WebGPU-capable browser</small>
          )}
          {!connected && webllmReady && (
            <small style={{ color: '#dc2626' }}>Backend WebSocket disconnected</small>
          )}
        </div>
        {error && (
          <div data-testid="agent-error" style={{ color: '#dc2626', fontSize: 13 }}>
            Error: {error}
          </div>
        )}
      </div>

      {/* Audit log live feed */}
      {auditFeed.length > 0 && (
        <section style={{ marginBottom: 12 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 6px' }}>Audit log (live)</h4>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {auditFeed.map((entry, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <strong>{entry.step}</strong>: {JSON.stringify(entry).slice(0, 200)}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Final recommendation */}
      {result && (
        <section style={{
          padding: 12,
          background: '#f0fdf4',
          border: '1px solid #16a34a',
          borderRadius: 4,
        }}>
          <h4 style={{ fontSize: 14, margin: '0 0 6px' }}>Recommendation</h4>
          <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {result.recommendation || '(no recommendation)'}
          </pre>
          {result.hitl_required && (
            <div style={{ marginTop: 8, color: '#b45309', fontSize: 13 }}>
              ⚠ HITL approval required before final action.
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
            request_id: <code>{result.request_id}</code>
          </div>
        </section>
      )}
    </div>
  );
}

function StatusPill({ label, ok, detail, testid }) {
  return (
    <div
      data-testid={testid}
      style={{
        padding: '6px 10px',
        border: `1px solid ${ok ? '#16a34a' : '#dc2626'}`,
        borderRadius: 4,
        background: ok ? '#f0fdf4' : '#fef2f2',
      }}
    >
      <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: ok ? '#15803d' : '#b91c1c' }}>
        {ok ? '✓ ' : '✗ '}
        {detail}
      </div>
    </div>
  );
}

export default WebLLMAgentPanel;
