/**
 * Regression test for the real tenant-isolation incident found live
 * 2026-09-02: this Vapi account also holds an unrelated production client's
 * assistant ("Domino's Pizza-Inbound Call"), and a manual test once nearly
 * overwrote it before this guard existed (see VapiClient.ts's own header
 * comment). This test exists specifically so that guard can never silently
 * regress — added 2026-09-08 as TD-09 from the engineering audit, which
 * found the guard was proven correct but had zero automated coverage.
 */
import { query } from '@/lib/db';
import { isOwnedAssistantId } from '@/domain/script/repository';
import { vapiRequest, VapiTenantIsolationError } from '@/domain/call/VapiClient';

jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('@/domain/script/repository', () => ({ isOwnedAssistantId: jest.fn() }));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedIsOwned = isOwnedAssistantId as jest.MockedFunction<typeof isOwnedAssistantId>;

describe('VapiClient tenant isolation guard', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);
    process.env.VAPI_API_KEY = 'test-key';
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  it('REFUSES to call Vapi for an assistantId this app did not create', async () => {
    mockedIsOwned.mockResolvedValue(false);
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(
      vapiRequest({
        method: 'PATCH',
        path: '/assistant/some-unowned-id',
        assistantId: 'some-unowned-id',
        initiatedBy: 'test',
      }),
    ).rejects.toThrow(VapiTenantIsolationError);

    // The whole point of the guard: never even attempt the real HTTP call.
    expect(global.fetch).not.toHaveBeenCalled();

    // And it must be logged as a blocked attempt, not silently swallowed.
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO vapi_api_audit_log'),
      expect.arrayContaining(['PATCH', '/assistant/some-unowned-id', 'some-unowned-id', true]),
    );
  });

  it('ALLOWS a real Vapi call for an assistantId this app did create', async () => {
    mockedIsOwned.mockResolvedValue(true);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 'owned-id' }),
    }) as unknown as typeof fetch;

    const result = await vapiRequest({
      method: 'PATCH',
      path: '/assistant/owned-id',
      assistantId: 'owned-id',
      initiatedBy: 'test',
    });

    expect(result).toEqual({ id: 'owned-id' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('ALLOWS creating a brand-new assistant (no assistantId yet, nothing to check ownership of)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ id: 'brand-new-id' }),
    }) as unknown as typeof fetch;

    const result = await vapiRequest({
      method: 'POST',
      path: '/assistant',
      initiatedBy: 'test',
    });

    expect(result).toEqual({ id: 'brand-new-id' });
    expect(mockedIsOwned).not.toHaveBeenCalled();
  });
});
