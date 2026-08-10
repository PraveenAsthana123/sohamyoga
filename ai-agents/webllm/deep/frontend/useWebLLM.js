// useWebLLM — initialize WebLLM (browser-native LLM) via WebGPU.
//
// Per §91 (WebLLM + CDP + RAG + LangGraph integration).
// Lazy-loads @mlc-ai/web-llm package — install if not present:
//   npm install @mlc-ai/web-llm

import { useEffect, useState, useCallback } from 'react';

const DEFAULT_MODEL = 'Llama-3.1-8B-Instruct-q4f32_1-MLC';

export function useWebLLM(model = DEFAULT_MODEL) {
  const [engine, setEngine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Dynamic import so build doesn't fail when package absent
        const mod = await import('@mlc-ai/web-llm').catch(() => null);
        if (!mod) {
          if (!cancelled) {
            setError('@mlc-ai/web-llm not installed · npm install @mlc-ai/web-llm');
            setLoading(false);
          }
          return;
        }
        const { CreateMLCEngine } = mod;
        const eng = await CreateMLCEngine(model, {
          initProgressCallback: (report) => {
            if (cancelled) return;
            setProgress(report.progress || 0);
            // eslint-disable-next-line no-console
            console.log('[WebLLM]', report.text);
          },
        });
        if (!cancelled) {
          setEngine(eng);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || String(e));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [model]);

  const prompt = useCallback(async (text, maxTokens = 512) => {
    if (!engine) throw new Error('WebLLM engine not ready');
    const reply = await engine.chat.completions.create({
      messages: [{ role: 'user', content: text }],
      max_tokens: maxTokens,
    });
    return reply.choices[0].message.content;
  }, [engine]);

  return { engine, loading, progress, error, prompt };
}

export default useWebLLM;
