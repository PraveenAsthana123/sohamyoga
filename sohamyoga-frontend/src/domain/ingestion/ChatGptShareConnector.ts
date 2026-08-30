// TypeScript port of scripts/chatgpt_share_extract.py's decode logic, so the
// admin "register a ChatGPT share link" flow doesn't need to shell out to
// Python from a Next.js API route. Keep this in sync with the Python source
// and the ~/.claude/scripts/ global copy per the global ChatGPT Shared-Link
// Extraction Policy — all three implement the same turbo-stream chunk-graph
// decode, independently, because they run in different environments (Node
// web app / standalone CLI / other-project CLI).
//
// See scripts/chatgpt_share_extract.py's module docstring for why a plain
// fetch + regex can't read these pages: the conversation is embedded as a
// React Router 7 "turbo-stream" payload — a flat array of "chunks" where
// {"_1": 2} means "a key equal to chunk[1]'s string value, pointing to
// chunk[2]" — not linear readable text.

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export interface ChatGptShareMessage {
  index: number;
  role: string;
  createTime: number | null;
  text: string;
}

export interface ChatGptShareResult {
  title: string | null;
  conversationId: string | null;
  messages: ChatGptShareMessage[];
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  return res.text();
}

/**
 * Pull the JS string-literal arguments passed to streamController.enqueue(...).
 * Can't use a regex here: escaped quotes followed by parens inside the payload
 * (e.g. code samples in the conversation text) break a lazy `"(.*?)"` match
 * well before the real end of the string. Walk byte-by-byte respecting
 * backslash escapes instead — same approach as the Python original.
 */
function extractEnqueuedStrings(html: string, marker: string): string[] {
  const results: string[] = [];
  let pos = 0;
  while (true) {
    const idx = html.indexOf(marker, pos);
    if (idx === -1) break;
    let i = idx + marker.length;
    if (html[i] !== '"') {
      pos = idx + marker.length;
      continue;
    }
    let j = i + 1;
    const n = html.length;
    while (j < n) {
      const c = html[j];
      if (c === '\\') {
        j += 2;
        continue;
      }
      if (c === '"') break;
      j += 1;
    }
    results.push(html.slice(i + 1, j));
    pos = j + 1;
  }
  return results;
}

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/**
 * Decode a turbo-stream chunk array into a plain JS value.
 * arr[i] is "chunk i". A dict chunk like {"_1": 2} encodes an object whose
 * entries are (decode(keyChunk), decodeRef(value)) pairs. Negative refs are
 * protocol sentinels (undefined/hole/etc) — collapsed to null, unneeded for
 * conversation content.
 */
function decodeTurboStream(chunkText: string): unknown {
  const arr = JSON.parse(chunkText) as Json[];
  const memo = new Map<number, unknown>();
  const inProgress = new Set<number>();

  function decodeRef(x: Json): unknown {
    if (typeof x === 'number') {
      if (x < 0) return null;
      return decode(x);
    }
    return x;
  }

  function decode(i: number): unknown {
    if (memo.has(i)) return memo.get(i);
    if (inProgress.has(i)) return null;
    inProgress.add(i);
    const v = arr[i];
    let result: unknown;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) {
        if (k.startsWith('_')) {
          const key = decode(Number(k.slice(1))) as string;
          out[key] = decodeRef(val as Json);
        } else {
          out[k] = val;
        }
      }
      result = out;
    } else if (Array.isArray(v)) {
      result = v.map(el => decodeRef(el));
    } else {
      result = v;
    }
    inProgress.delete(i);
    memo.set(i, result);
    return result;
  }

  return decode(0);
}

function findShareData(root: unknown): Record<string, unknown> {
  const loaderData = (root as Record<string, unknown>)?.loaderData as Record<string, unknown> | undefined;
  if (loaderData) {
    for (const routeVal of Object.values(loaderData)) {
      const serverResponse = (routeVal as Record<string, unknown> | undefined)?.serverResponse as
        | Record<string, unknown>
        | undefined;
      const data = serverResponse?.data as Record<string, unknown> | undefined;
      if (data && 'linear_conversation' in data) return data;
    }
  }
  throw new Error(
    'Could not find conversation data in decoded payload — ChatGPT may have changed their share-page format.'
  );
}

export async function extractChatGptShare(urlOrId: string): Promise<ChatGptShareResult> {
  const url = urlOrId.startsWith('http') ? urlOrId : `https://chatgpt.com/share/${urlOrId}`;
  const html = await fetchHtml(url);

  const calls = extractEnqueuedStrings(html, 'streamController.enqueue(');
  if (!calls.length) {
    throw new Error(
      "No streamController.enqueue(...) payload found — page structure may have changed, or this isn't a chatgpt.com/share/ URL."
    );
  }

  const biggest = calls.reduce((a, b) => (b.length > a.length ? b : a));
  const chunkText = (JSON.parse(`"${biggest}"`) as string).replace(/\n+$/, '');
  const decodedRoot = decodeTurboStream(chunkText);
  const shareData = findShareData(decodedRoot);

  const linear = (shareData.linear_conversation as Array<Record<string, unknown>>) ?? [];
  const messages: ChatGptShareMessage[] = [];
  for (const node of linear) {
    const msg = node.message as Record<string, unknown> | undefined;
    if (!msg) continue;
    const content = (msg.content as Record<string, unknown>) ?? {};
    const parts = (content.parts as unknown[]) ?? [];
    const text = parts
      .filter((p): p is string => typeof p === 'string')
      .join('\n')
      .trim();
    if (!text) continue;
    const metadata = (msg.metadata as Record<string, unknown>) ?? {};
    if (metadata.is_visually_hidden_from_conversation) continue;
    const author = (msg.author as Record<string, unknown>) ?? {};
    messages.push({
      index: messages.length,
      role: (author.role as string) ?? 'unknown',
      createTime: (msg.create_time as number) ?? null,
      text,
    });
  }

  return {
    title: (shareData.title as string) ?? null,
    conversationId: (shareData.conversation_id as string) ?? null,
    messages,
  };
}

// ── Phase 3: ConnectorAdapter implementation ────────────────────────────────
// Wraps extractChatGptShare() behind the shared ConnectorAdapter contract and
// a circuit breaker, so repeated failures (e.g. chatgpt.com down, or their
// page format changed and every decode is failing) fail fast for 30s instead
// of every scheduled refresh paying a full timeout per source.

import type { ConnectorAdapter, SourceEnvelope } from './ConnectorAdapter';
import { CircuitBreaker } from './ConnectorAdapter';

const breaker = new CircuitBreaker(3, 30_000);

export class ChatGptShareAdapter implements ConnectorAdapter {
  readonly connectorKey = 'chatgpt_shared_snapshot';

  async read(externalId: string): Promise<SourceEnvelope> {
    if (breaker.isOpen()) {
      throw new Error('ChatGPT share connector is temporarily circuit-broken after repeated failures — retry in a moment.');
    }
    try {
      const result = await extractChatGptShare(externalId);
      breaker.recordSuccess();
      return {
        sourceType: 'chatgpt_shared_snapshot',
        externalId,
        title: result.title,
        retrievedAt: new Date().toISOString(),
        items: result.messages.map(m => ({
          externalItemId: String(m.index),
          role: m.role,
          text: m.text,
          occurredAt: m.createTime ? Math.round(m.createTime * 1000) : null,
        })),
        metadata: result.conversationId ? { conversationId: result.conversationId } : undefined,
      };
    } catch (err) {
      breaker.recordFailure();
      throw err;
    }
  }
}
