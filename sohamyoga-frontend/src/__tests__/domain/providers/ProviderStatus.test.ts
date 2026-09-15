import { computeProviderStatus } from '@/domain/providers/ProviderStatus';

describe('computeProviderStatus (pure)', () => {
  it('reports not configured when real env vars are missing, never fabricated as connected (negative case)', () => {
    const result = computeProviderStatus({});
    expect(result.every((p) => !p.configured)).toBe(true);
    expect(result.find((p) => p.key === 'novu')?.missingEnvVars).toEqual(['NOVU_API_KEY', 'NOVU_BASE_URL']);
  });
  it('reports configured only when every real required env var is present (positive case)', () => {
    const result = computeProviderStatus({ NOVU_API_KEY: 'x', NOVU_BASE_URL: 'https://novu.example' });
    expect(result.find((p) => p.key === 'novu')?.configured).toBe(true);
  });
});
