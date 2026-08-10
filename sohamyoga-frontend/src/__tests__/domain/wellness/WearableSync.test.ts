import { describe, it, expect } from '@jest/globals';
import { WearableSync, type WearableSyncProps, type WearableDataPoint } from '../../../domain/wellness/WearableSync';

const NOW    = new Date('2026-08-05T10:00:00Z');
const LATER  = new Date('2026-08-05T11:00:00Z');
const FUTURE = new Date('2027-01-01T00:00:00Z');

function make(overrides?: Partial<WearableSyncProps>): WearableSync {
  return new WearableSync({
    id:         'ws-1',
    customerId: 'cust-1',
    platform:   'fitbit',
    status:     'disconnected',
    dataPoints: [],
    createdAt:  NOW,
    updatedAt:  NOW,
    ...overrides,
  });
}

function makeConnected(overrides?: Partial<WearableSyncProps>): WearableSync {
  return make({
    status:     'connected',
    deviceName: 'Fitbit Charge 6',
    connectedAt: NOW,
    ...overrides,
  });
}

const dp = (metric: string, value: number, at: Date): WearableDataPoint => ({
  metric, value, unit: 'count', recordedAt: at,
});

// ── Constructor ───────────────────────────────────────────────────────────────

describe('WearableSync — constructor', () => {
  it('creates disconnected sync', () => {
    const ws = make();
    expect(ws.platform).toBe('fitbit');
    expect(ws.status).toBe('disconnected');
    expect(ws.dataPoints).toHaveLength(0);
  });

  it('throws when id is empty', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws when customerId is empty', () => {
    expect(() => make({ customerId: '' })).toThrow('customerId is required');
  });

  it('throws when connected without connectedAt', () => {
    expect(() => make({ status: 'connected' }))
      .toThrow('connected status requires connectedAt');
  });

  it('throws when error status without errorMessage', () => {
    expect(() => make({ status: 'error' }))
      .toThrow('error status requires errorMessage');
  });

  it('throws when error status with empty errorMessage', () => {
    expect(() => make({ status: 'error', errorMessage: '  ' }))
      .toThrow('error status requires errorMessage');
  });

  it('throws when disconnectedAt set without connectedAt', () => {
    expect(() => make({ disconnectedAt: NOW }))
      .toThrow('disconnectedAt requires connectedAt');
  });

  it('throws when nextSyncAt <= lastSyncAt', () => {
    expect(() => makeConnected({ lastSyncAt: LATER, nextSyncAt: NOW }))
      .toThrow('nextSyncAt must be after lastSyncAt');
  });

  it('accepts valid connected sync with nextSyncAt after lastSyncAt', () => {
    expect(() => makeConnected({ lastSyncAt: NOW, nextSyncAt: FUTURE })).not.toThrow();
  });
});

// ── Status helpers ────────────────────────────────────────────────────────────

describe('status helpers', () => {
  it('isConnected returns true when connected', () => {
    expect(makeConnected().isConnected()).toBe(true);
  });

  it('isDisconnected returns true when disconnected', () => {
    expect(make().isDisconnected()).toBe(true);
  });

  it('isSyncing returns false for connected', () => {
    expect(makeConnected().isSyncing()).toBe(false);
  });

  it('isError returns true for error status', () => {
    const ws = make({ status: 'error', errorMessage: 'Auth failed', connectedAt: NOW });
    expect(ws.isError()).toBe(true);
  });

  it('isPendingAuth returns true for pending_auth', () => {
    expect(make({ status: 'pending_auth' }).isPendingAuth()).toBe(true);
  });
});

// ── connect() ────────────────────────────────────────────────────────────────

describe('connect()', () => {
  it('connects a disconnected device', () => {
    const ws = make().connect('Fitbit Charge 6', LATER);
    expect(ws.status).toBe('connected');
    expect(ws.deviceName).toBe('Fitbit Charge 6');
    expect(ws.connectedAt).toEqual(LATER);
    expect(ws.disconnectedAt).toBeUndefined();
    expect(ws.updatedAt).toEqual(LATER);
  });

  it('trims deviceName', () => {
    expect(make().connect('  Garmin  ', NOW).deviceName).toBe('Garmin');
  });

  it('throws when deviceName is empty', () => {
    expect(() => make().connect('', NOW)).toThrow('deviceName cannot be empty');
  });

  it('clears errorMessage on connect', () => {
    const ws = make({ status: 'error', errorMessage: 'Token expired', connectedAt: NOW });
    expect(ws.connect('Fitbit', LATER).errorMessage).toBeUndefined();
  });
});

// ── disconnect() ──────────────────────────────────────────────────────────────

describe('disconnect()', () => {
  it('disconnects a connected device', () => {
    const ws = makeConnected().disconnect(LATER);
    expect(ws.status).toBe('disconnected');
    expect(ws.disconnectedAt).toEqual(LATER);
  });

  it('throws when not connected', () => {
    expect(() => make().disconnect(NOW)).toThrow('can only disconnect a connected device');
  });

  it('throws when syncing', () => {
    const syncing = makeConnected().startSync(NOW);
    expect(() => syncing.disconnect(LATER)).toThrow('can only disconnect a connected device');
  });
});

// ── startSync() ───────────────────────────────────────────────────────────────

describe('startSync()', () => {
  it('transitions connected to syncing', () => {
    const ws = makeConnected().startSync(LATER);
    expect(ws.status).toBe('syncing');
    expect(ws.isSyncing()).toBe(true);
  });

  it('throws when not connected', () => {
    expect(() => make().startSync(NOW)).toThrow('can only start sync for a connected device');
  });
});

// ── completeSync() ────────────────────────────────────────────────────────────

describe('completeSync()', () => {
  it('transitions syncing to connected with new data points', () => {
    const ws = makeConnected().startSync(NOW)
      .completeSync([dp('steps', 8000, NOW), dp('heart_rate', 72, NOW)], LATER);
    expect(ws.status).toBe('connected');
    expect(ws.lastSyncAt).toEqual(LATER);
    expect(ws.dataPoints).toHaveLength(2);
  });

  it('appends to existing data points', () => {
    const existing = makeConnected({ dataPoints: [dp('steps', 5000, NOW)] });
    const ws = existing.startSync(NOW).completeSync([dp('steps', 7000, LATER)], LATER);
    expect(ws.dataPoints).toHaveLength(2);
  });

  it('throws when not syncing', () => {
    expect(() => makeConnected().completeSync([], LATER)).toThrow('can only complete sync when syncing');
  });

  it('clears errorMessage on successful sync', () => {
    const ws = makeConnected().startSync(NOW).completeSync([], LATER);
    expect(ws.errorMessage).toBeUndefined();
  });
});

// ── failSync() ────────────────────────────────────────────────────────────────

describe('failSync()', () => {
  it('transitions syncing to error', () => {
    const ws = makeConnected().startSync(NOW).failSync('API timeout', LATER);
    expect(ws.status).toBe('error');
    expect(ws.errorMessage).toBe('API timeout');
  });

  it('throws when errorMessage is empty', () => {
    expect(() => makeConnected().startSync(NOW).failSync('', LATER))
      .toThrow('errorMessage cannot be empty');
  });

  it('throws when not syncing', () => {
    expect(() => makeConnected().failSync('error', LATER)).toThrow('can only fail sync when syncing');
  });
});

// ── clearError() ──────────────────────────────────────────────────────────────

describe('clearError()', () => {
  it('transitions error to connected', () => {
    const ws = makeConnected().startSync(NOW).failSync('Timeout', LATER).clearError(LATER);
    expect(ws.status).toBe('connected');
    expect(ws.errorMessage).toBeUndefined();
  });

  it('throws when not in error status', () => {
    expect(() => makeConnected().clearError(NOW)).toThrow('can only clear error when in error status');
  });
});

// ── addDataPoint() ────────────────────────────────────────────────────────────

describe('addDataPoint()', () => {
  it('appends a data point', () => {
    const ws = make().addDataPoint(dp('steps', 10000, NOW));
    expect(ws.dataPoints).toHaveLength(1);
    expect(ws.dataPoints[0].metric).toBe('steps');
    expect(ws.dataPoints[0].value).toBe(10000);
  });

  it('data points getter returns copies', () => {
    const ws = makeConnected({ dataPoints: [dp('steps', 5000, NOW)] });
    const points = ws.dataPoints;
    points[0].value = 99999;
    expect(ws.dataPoints[0].value).toBe(5000);
  });
});

// ── latestDataPoint() ─────────────────────────────────────────────────────────

describe('latestDataPoint()', () => {
  it('returns undefined when no data points', () => {
    expect(make().latestDataPoint('steps')).toBeUndefined();
  });

  it('returns undefined when metric not found', () => {
    const ws = make().addDataPoint(dp('heart_rate', 72, NOW));
    expect(ws.latestDataPoint('steps')).toBeUndefined();
  });

  it('returns the most recent data point for metric', () => {
    const ws = make()
      .addDataPoint(dp('steps', 5000, NOW))
      .addDataPoint(dp('steps', 8000, LATER));
    expect(ws.latestDataPoint('steps')?.value).toBe(8000);
  });

  it('ignores other metrics when finding latest', () => {
    const ws = make()
      .addDataPoint(dp('steps', 9000, LATER))
      .addDataPoint(dp('heart_rate', 72, NOW));
    expect(ws.latestDataPoint('steps')?.value).toBe(9000);
    expect(ws.latestDataPoint('heart_rate')?.value).toBe(72);
  });

  it('returns a defensive copy', () => {
    const ws = make().addDataPoint(dp('steps', 5000, NOW));
    const point = ws.latestDataPoint('steps')!;
    point.value = 99999;
    expect(ws.latestDataPoint('steps')?.value).toBe(5000);
  });
});

// ── Platform coverage ─────────────────────────────────────────────────────────

describe('all platforms accepted', () => {
  const platforms = ['fitbit','garmin','apple_health','google_fit','samsung_health','polar'] as const;
  it.each(platforms)('accepts platform: %s', (p) => {
    expect(() => make({ platform: p })).not.toThrow();
  });
});
