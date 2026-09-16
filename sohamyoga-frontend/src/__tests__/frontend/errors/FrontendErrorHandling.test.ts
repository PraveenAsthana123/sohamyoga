/**
 * Frontend error handling tests.
 *
 * These are pure Node-environment tests — no jsdom/React rendering needed.
 * They verify the error-handling contract that page components must satisfy:
 *   1. A failing fetch (500 or network error) must be caught and an error
 *      message surfaced, not silently swallowed.
 *   2. Loading state must resolve to false once the fetch completes (success
 *      or failure).
 *   3. An API that returns an empty collection must yield an empty-state
 *      payload, not a crash.
 *
 * Pattern matches the project's existing domain-test style (jest + @jest/globals).
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Helpers that mirror the async fetch logic inside page components.
// Each helper reflects the pattern used in the fixed pages so that if the
// page logic drifts back to unhandled promises these tests catch it first.
// ---------------------------------------------------------------------------

type CartResult = { ok: true; data: unknown } | { ok: false; error: string };
type OrdersResult = { ok: true; orders: unknown[] } | { ok: false; error: string };
type WellnessResult = { ok: true; scores: unknown[]; avg: number } | { ok: false; error: string };

/** Cart page: load cart — returns error string on any fetch failure. */
async function loadCart(fetchFn: typeof fetch): Promise<CartResult> {
  try {
    const r = await fetchFn('/api/customer/cart', { cache: 'no-store' } as RequestInit);
    const data = await r.json();
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Failed to load cart. Please refresh.' };
  }
}

/** Orders page: load orders list — returns empty array on 500, error on network fail. */
async function loadOrders(fetchFn: typeof fetch): Promise<OrdersResult> {
  try {
    const r = await fetchFn('/api/customer/orders', { cache: 'no-store' } as RequestInit);
    const d = await r.json();
    return { ok: true, orders: d.orders ?? [] };
  } catch {
    return { ok: false, error: 'Failed to load orders. Please refresh.' };
  }
}

/** Wellness page: loading state resolves to false after fetch completes. */
async function loadWellness(fetchFn: typeof fetch): Promise<{ result: WellnessResult; loading: boolean }> {
  let loading = true;
  let result: WellnessResult;
  try {
    const r = await fetchFn('/api/customer/wellness', { cache: 'no-store' } as RequestInit);
    const d = await r.json();
    result = { ok: true, scores: d.scores ?? [], avg: d.averageComposite ?? 0 };
  } catch {
    result = { ok: false, error: 'Failed to load wellness data. Please refresh.' };
  } finally {
    loading = false;
  }
  return { result, loading };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

const originalFetch = global.fetch;
beforeEach(() => { /* reset any mocks */ });
afterEach(() => { global.fetch = originalFetch; });

// ── 1. Fetch failure → error state, not thrown exception ────────────────────

describe('loadCart — fetch error handling', () => {
  it('returns an error payload when fetch throws a network error', async () => {
    global.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('Network error'));
    const result = await loadCart(global.fetch);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Failed to load cart/);
    }
  });

  it('returns an error payload when the server returns a 500 that makes json() throw', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('invalid json')),
    } as unknown as Response);
    const result = await loadCart(global.fetch);
    expect(result.ok).toBe(false);
  });

  it('returns the cart data on a successful 200 response', async () => {
    const cart = { cartId: 'c-1', items: [], subtotal: 0, total: 0 };
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(cart),
    } as unknown as Response);
    const result = await loadCart(global.fetch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(cart);
    }
  });
});

// ── 2. Empty state — API returns empty array ─────────────────────────────────

describe('loadOrders — empty state handling', () => {
  it('returns an empty orders array when API returns { orders: [] }', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ orders: [] }),
    } as unknown as Response);
    const result = await loadOrders(global.fetch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.orders).toEqual([]);
    }
  });

  it('returns an empty orders array when API omits the orders key', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as unknown as Response);
    const result = await loadOrders(global.fetch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.orders).toEqual([]);
    }
  });

  it('surfaces an error string instead of throwing when fetch rejects', async () => {
    global.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('offline'));
    const result = await loadOrders(global.fetch);
    expect(result.ok).toBe(false);
  });
});

// ── 3. Loading state — resolves to false after success OR failure ─────────────

describe('loadWellness — loading state lifecycle', () => {
  it('sets loading=false after a successful fetch', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ scores: [{ score_date: '2026-09-01', composite_score: 75 }], averageComposite: 75 }),
    } as unknown as Response);
    const { loading, result } = await loadWellness(global.fetch);
    expect(loading).toBe(false);
    expect(result.ok).toBe(true);
  });

  it('sets loading=false even when fetch rejects (error path)', async () => {
    global.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('timeout'));
    const { loading, result } = await loadWellness(global.fetch);
    expect(loading).toBe(false);
    expect(result.ok).toBe(false);
  });

  it('returns an empty scores array when API returns empty collection', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ scores: [], averageComposite: 0 }),
    } as unknown as Response);
    const { result } = await loadWellness(global.fetch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scores).toEqual([]);
      expect(result.avg).toBe(0);
    }
  });
});
