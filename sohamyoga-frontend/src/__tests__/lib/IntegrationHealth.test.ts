import { getIntegrationHealth } from '@/lib/integrationHealth';
import { databaseConfigured, query } from '@/lib/postgres';
import { ollamaHealth } from '@/lib/ollama';

jest.mock('@/lib/postgres', () => ({ databaseConfigured: jest.fn(), query: jest.fn() }));
jest.mock('@/lib/ollama', () => ({ ollamaHealth: jest.fn(), OLLAMA_URL: 'http://localhost:11434' }));

const originalFetch = global.fetch;
const originalEnv = { ...process.env };
beforeEach(() => {
  jest.resetAllMocks();
  process.env = { ...originalEnv, ACTIVEPIECES_URL: 'http://workflow.test' };
  delete process.env.OPENBAO_ADDR;
  delete process.env.POSTIZ_CLIENT_URL;
  jest.mocked(databaseConfigured).mockReturnValue(true);
  jest.mocked(query).mockResolvedValue({ rows: [], rowCount: 0 } as never);
  jest.mocked(ollamaHealth).mockResolvedValue({ ok: true, models: [] } as never);
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
});
afterEach(() => { global.fetch = originalFetch; process.env = { ...originalEnv }; });

it('keeps other integration results when one probe rejects', async () => {
  jest.mocked(ollamaHealth).mockRejectedValue(new Error('provider failure'));
  const results = await getIntegrationHealth();
  expect(results).toHaveLength(5);
  expect(results.find(r => r.name === 'Ollama')?.status).toBe('error');
  expect(results.find(r => r.name === 'PostgreSQL')?.status).toBe('connected');
});

it('reports an unreachable configured workflow service as an error', async () => {
  jest.mocked(global.fetch).mockRejectedValue(new Error('offline'));
  const results = await getIntegrationHealth();
  expect(results.find(r => r.name === 'Activepieces')?.status).toBe('error');
});

it('does not cache live health probes', async () => {
  await getIntegrationHealth();
  expect(global.fetch).toHaveBeenCalledWith('http://workflow.test/api/v1/health',
    expect.objectContaining({ cache: 'no-store' }));
});
