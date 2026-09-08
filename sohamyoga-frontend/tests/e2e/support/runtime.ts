// Moved off 8085 on 2026-09-01 -- see PORT_REGISTRY.md: docker-compose's
// sohamyoga-nginx also binds 8085, and silently wins the port over a local
// dev server when both are up.
const DEFAULT_E2E_BASE_URL = 'http://127.0.0.1:8095';

export const E2E_BASE_URL = (process.env.SOHAM_BASE_URL || DEFAULT_E2E_BASE_URL).replace(/\/$/, '');

export function apiUrl(path: string): string {
  return new URL(path, `${E2E_BASE_URL}/`).toString();
}
