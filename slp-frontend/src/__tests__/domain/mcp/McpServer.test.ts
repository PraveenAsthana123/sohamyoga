import { describe, it, expect } from '@jest/globals';
import { McpServer, type McpServerProps, type McpServerStatus } from '../../../domain/mcp/McpServer';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');

function make(overrides?: Partial<McpServerProps>): McpServer {
  return new McpServer({
    id:          'srv-1',
    tenantId:    'tenant-1',
    name:        'Booking MCP',
    slug:        'booking-mcp',
    version:     '1.0.0',
    endpoint:    'http://localhost:4000',
    status:      'online',
    toolCount:   13,
    description: 'Booking domain MCP server',
    isEnabled:   true,
    createdAt:   NOW,
    updatedAt:   NOW,
    ...overrides,
  });
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe('McpServer — constructor', () => {
  it('creates an online enabled server', () => {
    const s = make();
    expect(s.status).toBe('online');
    expect(s.isEnabled).toBe(true);
    expect(s.isHealthy()).toBe(true);
  });

  it('throws when id is empty',       () => expect(() => make({ id: '' })).toThrow('id is required'));
  it('throws when tenantId is empty', () => expect(() => make({ tenantId: '' })).toThrow('tenantId is required'));
  it('throws when name is empty',     () => expect(() => make({ name: '' })).toThrow('name is required'));
  it('throws when slug is empty',     () => expect(() => make({ slug: '' })).toThrow('slug is required'));
  it('throws when version is empty',  () => expect(() => make({ version: '' })).toThrow('version is required'));
  it('throws when endpoint is empty', () => expect(() => make({ endpoint: '' })).toThrow('endpoint is required'));

  it('throws when slug has uppercase', () => {
    expect(() => make({ slug: 'BookingMCP' })).toThrow('lowercase alphanumeric');
  });

  it('throws when slug has spaces', () => {
    expect(() => make({ slug: 'booking mcp' })).toThrow('lowercase alphanumeric');
  });

  it('accepts slug with hyphens', () => {
    expect(() => make({ slug: 'booking-mcp-v2' })).not.toThrow();
  });

  it('throws when toolCount is negative', () => {
    expect(() => make({ toolCount: -1 })).toThrow('non-negative integer');
  });

  it('throws when toolCount is non-integer', () => {
    expect(() => make({ toolCount: 1.5 })).toThrow('non-negative integer');
  });

  it('accepts toolCount of 0', () => {
    expect(() => make({ toolCount: 0 })).not.toThrow();
  });

  it('throws when maintenance status has no note', () => {
    expect(() => make({ status: 'maintenance' })).toThrow('maintenanceNote is required');
  });

  it('creates maintenance server with note', () => {
    const s = make({ status: 'maintenance', maintenanceNote: 'Upgrade in progress' });
    expect(s.isInMaintenance()).toBe(true);
  });
});

// ── Status helpers ────────────────────────────────────────────────────────────

describe('status helpers', () => {
  const statuses: McpServerStatus[] = ['online', 'offline', 'degraded'];
  it.each(statuses)('accepts status: %s', status => {
    expect(() => make({ status })).not.toThrow();
  });

  it('isHealthy() requires online AND enabled', () => {
    expect(make().isHealthy()).toBe(true);
    expect(make({ isEnabled: false }).isHealthy()).toBe(false);
    expect(make({ status: 'degraded' }).isHealthy()).toBe(false);
  });
});

// ── markOnline() ──────────────────────────────────────────────────────────────

describe('markOnline()', () => {
  it('offline → online', () => {
    const s = make({ status: 'offline' }).markOnline(LATER);
    expect(s.isOnline()).toBe(true);
    expect(s.lastCheckedAt).toEqual(LATER);
    expect(s.updatedAt).toEqual(LATER);
  });

  it('degraded → online', () => {
    expect(make({ status: 'degraded' }).markOnline(LATER).isOnline()).toBe(true);
  });

  it('throws when in maintenance', () => {
    const s = make({ status: 'maintenance', maintenanceNote: 'upgrade' });
    expect(() => s.markOnline(LATER)).toThrow('end maintenance');
  });
});

// ── markOffline() ─────────────────────────────────────────────────────────────

describe('markOffline()', () => {
  it('online → offline', () => {
    const s = make().markOffline(LATER);
    expect(s.isOffline()).toBe(true);
    expect(s.updatedAt).toEqual(LATER);
  });

  it('any status → offline', () => {
    expect(make({ status: 'degraded' }).markOffline(LATER).isOffline()).toBe(true);
  });
});

// ── markDegraded() ────────────────────────────────────────────────────────────

describe('markDegraded()', () => {
  it('online → degraded', () => {
    expect(make().markDegraded(LATER).isDegraded()).toBe(true);
  });

  it('throws when offline', () => {
    expect(() => make({ status: 'offline' }).markDegraded(LATER)).toThrow('offline server');
  });
});

// ── startMaintenance() / endMaintenance() ─────────────────────────────────────

describe('startMaintenance() / endMaintenance()', () => {
  it('online → maintenance', () => {
    const s = make().startMaintenance('DB migration', LATER);
    expect(s.isInMaintenance()).toBe(true);
    expect(s.maintenanceNote).toBe('DB migration');
  });

  it('throws when note is empty', () => {
    expect(() => make().startMaintenance('', LATER)).toThrow('maintenanceNote is required');
  });

  it('throws when already in maintenance', () => {
    const s = make({ status: 'maintenance', maintenanceNote: 'upgrade' });
    expect(() => s.startMaintenance('another', LATER)).toThrow('already in maintenance');
  });

  it('maintenance → online, clears note', () => {
    const s = make({ status: 'maintenance', maintenanceNote: 'upgrade' }).endMaintenance(LATER);
    expect(s.isOnline()).toBe(true);
    expect(s.maintenanceNote).toBeUndefined();
  });

  it('throws endMaintenance when not in maintenance', () => {
    expect(() => make().endMaintenance(LATER)).toThrow('not in maintenance');
  });
});

// ── enable() / disable() ──────────────────────────────────────────────────────

describe('enable() / disable()', () => {
  it('disables an enabled server', () => {
    const s = make().disable(LATER);
    expect(s.isEnabled).toBe(false);
    expect(s.updatedAt).toEqual(LATER);
  });

  it('throws disabling already-disabled', () => {
    expect(() => make({ isEnabled: false }).disable(LATER)).toThrow('already disabled');
  });

  it('enables a disabled server', () => {
    expect(make({ isEnabled: false }).enable(LATER).isEnabled).toBe(true);
  });

  it('throws enabling already-enabled', () => {
    expect(() => make().enable(LATER)).toThrow('already enabled');
  });
});

// ── updateToolCount() / recordCheck() ─────────────────────────────────────────

describe('updateToolCount() / recordCheck()', () => {
  it('updates tool count', () => {
    const s = make().updateToolCount(15, LATER);
    expect(s.toolCount).toBe(15);
  });

  it('accepts 0 tools', () => {
    expect(make().updateToolCount(0, LATER).toolCount).toBe(0);
  });

  it('throws on negative', () => {
    expect(() => make().updateToolCount(-1, LATER)).toThrow('non-negative integer');
  });

  it('recordCheck updates lastCheckedAt', () => {
    const s = make().recordCheck(LATER);
    expect(s.lastCheckedAt).toEqual(LATER);
  });
});

// ── Immutability ──────────────────────────────────────────────────────────────

describe('immutability', () => {
  it('markOffline does not mutate original', () => {
    const original = make();
    original.markOffline(LATER);
    expect(original.status).toBe('online');
  });
});
