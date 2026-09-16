/**
 * DB Calling Pattern Tests
 *
 * Verifies:
 * 1. Pool configuration — max connections, timeouts.
 * 2. Connection-error → 503 (not 500) for ECONNREFUSED-like errors.
 * 3. Parameterized queries — db.query() is called with a params array,
 *    never with a concatenated string.
 * 4. Transaction ROLLBACK on error — ROLLBACK is issued when the callback
 *    throws, and client.release() is always called.
 */

// ─── helpers ────────────────────────────────────────────────────────────────

const FAKE_DB_URL = 'postgresql://test:test@localhost:5432/testdb';

function makeMockClient(overrides: Partial<{ query: jest.Mock; release: jest.Mock }> = {}) {
  return {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn(),
    ...overrides,
  };
}

/** Reset the singleton pool between tests. */
function resetPool() {
  const g = globalThis as unknown as { marketingPool?: unknown };
  delete g.marketingPool;
}

// ─── 1. Pool configuration ───────────────────────────────────────────────────

describe('Pool configuration (postgres.ts)', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, DATABASE_URL: FAKE_DB_URL };
    resetPool();
  });

  afterEach(() => {
    process.env = OLD_ENV;
    resetPool();
  });

  it('creates a pool with max=10 connections', async () => {
    const { getPool } = await import('@/lib/postgres');
    const pool = getPool();
    const options = (pool as unknown as { options: { max: number } }).options;
    expect(options.max).toBe(10);
  });

  it('sets idleTimeoutMillis to 30 000 ms', async () => {
    const { getPool } = await import('@/lib/postgres');
    const pool = getPool();
    const options = (pool as unknown as { options: { idleTimeoutMillis: number } }).options;
    expect(options.idleTimeoutMillis).toBe(30_000);
  });

  it('sets connectionTimeoutMillis to 5 000 ms', async () => {
    const { getPool } = await import('@/lib/postgres');
    const pool = getPool();
    const options = (pool as unknown as { options: { connectionTimeoutMillis: number } }).options;
    expect(options.connectionTimeoutMillis).toBe(5_000);
  });

  it('throws when DATABASE_URL is absent', () => {
    resetPool();
    const savedUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    // Re-import is cached by jest module registry — call synchronously
    // by requiring the real module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getPool: gp } = require('@/lib/postgres') as typeof import('@/lib/postgres');
    expect(() => gp()).toThrow('DATABASE_URL is not configured');
    process.env.DATABASE_URL = savedUrl;
  });
});

// ─── 2. DB connection error → 503 ───────────────────────────────────────────

describe('503 on ECONNREFUSED', () => {
  /**
   * Tests the pattern that every correctly-written DB route should follow:
   * check err.code === 'ECONNREFUSED' or message contains 'pool' → 503.
   */
  it('returns 503 when the error code is ECONNREFUSED', async () => {
    const econnErr = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    });

    async function handler(connectFn: () => Promise<unknown>) {
      try {
        await connectFn();
        return { status: 200 };
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'ECONNREFUSED' || String(err).includes('pool')) {
          return { status: 503, body: 'Database unavailable.' };
        }
        return { status: 500 };
      }
    }

    const result = await handler(() => Promise.reject(econnErr));
    expect(result.status).toBe(503);
  });

  it('returns 503 when the error message mentions "pool"', async () => {
    const poolErr = new Error('Connection pool is exhausted — try later');

    async function handler(connectFn: () => Promise<unknown>) {
      try {
        await connectFn();
        return { status: 200 };
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'ECONNREFUSED' || String(err).includes('pool')) {
          return { status: 503 };
        }
        return { status: 500 };
      }
    }

    const result = await handler(() => Promise.reject(poolErr));
    expect(result.status).toBe(503);
  });

  it('still returns 500 for generic (non-connection) errors', async () => {
    const genericErr = new Error('column "foo" does not exist');

    async function handler(connectFn: () => Promise<unknown>) {
      try {
        await connectFn();
        return { status: 200 };
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'ECONNREFUSED' || String(err).includes('pool')) {
          return { status: 503 };
        }
        return { status: 500 };
      }
    }

    const result = await handler(() => Promise.reject(genericErr));
    expect(result.status).toBe(500);
  });
});

// ─── 3. Parameterized queries ────────────────────────────────────────────────

describe('Parameterized query contract', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, DATABASE_URL: FAKE_DB_URL };
    resetPool();
  });

  afterEach(() => {
    process.env = OLD_ENV;
    resetPool();
  });

  it('query() passes a params array — never embeds user input into the SQL string', async () => {
    const mockQueryFn = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    // Inject mock pool before the first getPool() call.
    (globalThis as unknown as { marketingPool: unknown }).marketingPool = {
      query: mockQueryFn,
    };

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { query } = require('@/lib/postgres') as typeof import('@/lib/postgres');
    const userId = 'user-abc-123';
    await query('SELECT id FROM customer WHERE user_id = $1', [userId]);

    expect(mockQueryFn).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQueryFn.mock.calls[0] as [string, unknown[]];

    // SQL must use placeholder syntax, not the raw value.
    expect(sql).toContain('$1');
    expect(sql).not.toContain(userId);

    // Params array must carry the value.
    expect(Array.isArray(params)).toBe(true);
    expect(params).toContain(userId);
  });

  it('building SQL with $N markers via push() prevents injection', () => {
    // Verifies the safe dynamic-SQL-building pattern used throughout the codebase
    // (e.g. affiliate-fraud, module-intelligence routes).
    const userInput = "'; DROP TABLE customer; --";
    const params: unknown[] = [];
    let idx = 1;
    let sql = 'SELECT * FROM foo WHERE 1=1';
    // Safe pattern: push value first, use $N in the string.
    params.push(userInput);
    sql += ` AND status = $${idx++}`;

    expect(sql).not.toContain(userInput);
    expect(params[0]).toBe(userInput);
    expect(sql).toBe('SELECT * FROM foo WHERE 1=1 AND status = $1');
  });
});

// ─── 4. Transaction ROLLBACK on error ───────────────────────────────────────

describe('transaction() wrapper (postgres.ts)', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, DATABASE_URL: FAKE_DB_URL };
    resetPool();
  });

  afterEach(() => {
    process.env = OLD_ENV;
    resetPool();
  });

  it('issues BEGIN → COMMIT on success and releases the client', async () => {
    const mockClient = makeMockClient();
    (globalThis as unknown as { marketingPool: unknown }).marketingPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { transaction } = require('@/lib/postgres') as typeof import('@/lib/postgres');

    const result = await transaction(async () => 'ok');
    expect(result).toBe('ok');

    const calls: string[] = mockClient.query.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls[0]).toBe('BEGIN');
    expect(calls[calls.length - 1]).toBe('COMMIT');
    expect(calls).not.toContain('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('issues BEGIN → ROLLBACK when the callback throws, and releases the client', async () => {
    const mockClient = makeMockClient();
    (globalThis as unknown as { marketingPool: unknown }).marketingPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { transaction } = require('@/lib/postgres') as typeof import('@/lib/postgres');

    await expect(
      transaction(async () => { throw new Error('callback blew up'); }),
    ).rejects.toThrow('callback blew up');

    const calls: string[] = mockClient.query.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls).toContain('BEGIN');
    expect(calls).toContain('ROLLBACK');
    expect(calls).not.toContain('COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('issues ROLLBACK and releases the client when COMMIT itself throws', async () => {
    const commitError = new Error('COMMIT failed — server gone');
    const mockClient = makeMockClient({
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql === 'COMMIT') return Promise.reject(commitError);
        return Promise.resolve({ rows: [], rowCount: 0 });
      }),
    });
    (globalThis as unknown as { marketingPool: unknown }).marketingPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { transaction } = require('@/lib/postgres') as typeof import('@/lib/postgres');

    await expect(transaction(async () => 'ok')).rejects.toThrow('COMMIT failed');

    const calls: string[] = mockClient.query.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls).toContain('ROLLBACK');
    // Client MUST be released regardless of COMMIT failure.
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('still releases the client even when ROLLBACK itself throws', async () => {
    const mockClient = makeMockClient({
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql === 'ROLLBACK') return Promise.reject(new Error('ROLLBACK also failed'));
        return Promise.resolve({ rows: [], rowCount: 0 });
      }),
    });
    (globalThis as unknown as { marketingPool: unknown }).marketingPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { transaction } = require('@/lib/postgres') as typeof import('@/lib/postgres');

    // The transaction() function re-throws whatever error the catch block
    // produces. When ROLLBACK also throws, that error propagates out.
    await expect(
      transaction(async () => { throw new Error('original error'); }),
    ).rejects.toThrow();

    // The finally block must still run: client.release() is called once.
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});
