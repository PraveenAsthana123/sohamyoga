// Phase 3 — Universal Connector Framework (real, scoped-down slice).
// One adapter interface every connector implements, so the orchestration
// layer (chatGptSourceOps.ts today, future connector ops files) talks to a
// consistent contract instead of a bespoke shape per source. Only one real
// connector exists (chatgpt_shared_snapshot) — this interface is deliberately
// small, sized to what that one connector actually needs, not the full
// discover/write/webhook/incremental_sync/history/search capability surface
// Phase 3's literal spec asks for. Extend it when a second connector's real
// requirements demand it, not speculatively.

export interface SourceEnvelopeItem {
  externalItemId: string;
  role: string;
  text: string;
  occurredAt: number | null;
}

export interface SourceEnvelope {
  sourceType: string;
  externalId: string;
  title: string | null;
  retrievedAt: string;
  items: SourceEnvelopeItem[];
  /** Connector-specific extras (e.g. ChatGPT's conversationId, used for
   * cross-registration duplicate detection — Phase 7). Optional; most
   * connectors don't need this. */
  metadata?: Record<string, unknown>;
}

export interface ConnectorAdapter {
  readonly connectorKey: string;
  read(externalId: string): Promise<SourceEnvelope>;
  /** Optional — only connectors capable of bulk discovery (e.g. folder scanning)
   * implement this. Manually-registered connectors (e.g. ChatGPT share links,
   * one URL at a time) have no meaningful "discover everything" operation. */
  discover?(): Promise<string[]>;
}

/** Generic 3-failure/30s-cooldown breaker. Deliberately not the Ollama-specific
 * one in packages/shared-backend — same shape, but importing an Ollama-branded
 * package into an unrelated HTTP-fetch connector would be a wrong-fit reuse. */
export class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;

  constructor(private readonly threshold = 3, private readonly cooldownMs = 30_000) {}

  isOpen(): boolean {
    return Date.now() < this.openUntil;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openUntil = 0;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.openUntil = Date.now() + this.cooldownMs;
      this.failures = 0;
    }
  }
}
