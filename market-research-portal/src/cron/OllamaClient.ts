// Re-exports the shared client (packages/shared-backend) — deduplicated
// 2026-08-24 after this file and sohamyoga-frontend's lib/ollama.ts grew
// the same circuit-breaker logic independently. Kept as a thin re-export so
// every existing `from '../OllamaClient'` / `from './OllamaClient'` import
// across this app's cron jobs didn't need touching.
import { OllamaClient } from '@sohamyoga/shared-backend';
export { OllamaClient, OLLAMA_MODELS, type OllamaModelTier, type GenerateOptions } from '@sohamyoga/shared-backend';

export const ollama = new OllamaClient();
