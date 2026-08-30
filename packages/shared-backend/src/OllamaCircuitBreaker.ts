// The actual duplicated logic between sohamyoga-frontend's lib/ollama.ts
// and market-research-portal's cron/OllamaClient.ts: after repeated
// failures, fast-fail for a cooldown instead of making every caller wait
// out a full timeout against a daemon already known to be down. Extracted
// as a standalone state machine (no fetch/DB coupling) so both apps' very
// different Ollama-calling code (one streams with observability telemetry,
// one does simple non-streaming generate) can share the same breaker
// instead of each hand-rolling its own copy.
export class OllamaCircuitBreaker {
  private failures = 0;
  private openUntil = 0;

  constructor(
    private readonly threshold = 3,
    private readonly cooldownMs = 30_000,
  ) {}

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
