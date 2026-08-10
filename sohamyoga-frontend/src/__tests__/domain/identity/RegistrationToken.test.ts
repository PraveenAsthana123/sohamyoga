import { RegistrationToken, RegistrationTokenProps, CheckInEvent } from '../../../domain/identity/RegistrationToken';

const NOW          = new Date('2026-08-05T10:00:00Z');
const LATER        = new Date('2026-08-05T11:00:00Z');
const PAST         = new Date('2026-08-05T09:00:00Z');
// Windows that satisfy validUntil > validFrom for edge-case tokens
const PAST_START   = new Date('2026-08-05T07:00:00Z');
const PAST_END     = new Date('2026-08-05T08:00:00Z');  // entirely in the past
const FUTURE_START = new Date('2026-08-05T12:00:00Z');
const FUTURE_END   = new Date('2026-08-05T13:00:00Z');  // entirely in the future

function make(overrides: Partial<RegistrationTokenProps> = {}): RegistrationToken {
  return new RegistrationToken({
    id:           'rt-1',
    tokenValue:   'tk_8f32a7c91d4e56b78a9c0d1e2f3a4b5c',
    type:         'class_booking',
    status:       'active',
    referenceId:  'booking-42',
    customerId:   'cust-1',
    validFrom:    PAST,
    validUntil:   LATER,
    lastScannedAt: null,
    scanCount:    0,
    scanHistory:  [],
    tenantId:     'tenant-1',
    createdAt:    NOW,
    updatedAt:    NOW,
    ...overrides,
  });
}

const scanEvent = (result = 'valid' as CheckInEvent['result']): CheckInEvent => ({
  scannedAt:  NOW,
  scannedBy:  'teacher-1',
  deviceId:   'device-1',
  result,
  note:       null,
  overrideBy: null,
});

describe('RegistrationToken', () => {
  describe('constructor', () => {
    it('creates successfully', () => {
      const t = make();
      expect(t.status).toBe('active');
      expect(t.scanCount).toBe(0);
    });

    it('throws when validUntil ≤ validFrom', () => {
      expect(() => make({ validFrom: LATER, validUntil: NOW })).toThrow('validUntil must be after validFrom');
    });

    it('throws on blank tokenValue', () => {
      expect(() => make({ tokenValue: '' })).toThrow('tokenValue is required');
    });
  });

  describe('isExpired / isActive', () => {
    it('reports active when inside validity window', () => {
      expect(make().isActive(NOW)).toBe(true);
    });

    it('reports expired after validUntil', () => {
      const t = make({ validFrom: PAST_START, validUntil: PAST_END });
      expect(t.isExpired(NOW)).toBe(true);
    });

    it('reports not active before validFrom', () => {
      const t = make({ validFrom: FUTURE_START, validUntil: FUTURE_END });
      expect(t.isActive(NOW)).toBe(false);
    });
  });

  describe('recordScan', () => {
    it('increments scanCount and records event', () => {
      const t = make().recordScan(scanEvent());
      expect(t.scanCount).toBe(1);
      expect(t.lastScannedAt).toEqual(NOW);
      expect(t.scanHistory).toHaveLength(1);
    });

    it('marks class_booking as used after first valid scan', () => {
      const t = make({ type: 'class_booking' }).recordScan(scanEvent('valid'));
      expect(t.status).toBe('used');
    });

    it('does not change status for invalid scan result', () => {
      const t = make({ type: 'class_booking' }).recordScan(scanEvent('too_early'));
      expect(t.status).toBe('active');
    });

    it('does not mark membership as used on scan', () => {
      const t = make({ type: 'membership' }).recordScan(scanEvent('valid'));
      expect(t.status).toBe('active');
    });

    it('throws on revoked token', () => {
      expect(() => make({ status: 'revoked' }).recordScan(scanEvent())).toThrow('revoked');
    });

    it('throws on cancelled token', () => {
      expect(() => make({ status: 'cancelled' }).recordScan(scanEvent())).toThrow('cancelled');
    });
  });

  describe('isAlreadyScanned', () => {
    it('returns false before any scan', () => {
      expect(make({ type: 'class_booking' }).isAlreadyScanned()).toBe(false);
    });

    it('returns true after first scan for class_booking', () => {
      const t = make({ type: 'class_booking', scanCount: 1, status: 'used' });
      expect(t.isAlreadyScanned()).toBe(true);
    });

    it('returns false for membership type even after scan', () => {
      const t = make({ type: 'membership', scanCount: 3 });
      expect(t.isAlreadyScanned()).toBe(false);
    });
  });

  describe('revoke / cancel', () => {
    it('revokes an active token', () => {
      expect(make().revoke().status).toBe('revoked');
    });

    it('throws revoking a used token', () => {
      expect(() => make({ status: 'used' }).revoke()).toThrow('used');
    });

    it('cancels an active token', () => {
      expect(make().cancel().status).toBe('cancelled');
    });

    it('throws cancelling a used token', () => {
      expect(() => make({ status: 'used' }).cancel()).toThrow('used');
    });
  });

  describe('checkinUrl', () => {
    it('builds the correct URL', () => {
      const url = make({ tokenValue: 'tk_abc123' }).checkinUrl('https://portal.sohamyoga.ca');
      expect(url).toBe('https://portal.sohamyoga.ca/checkin/tk_abc123');
    });
  });

  describe('immutability', () => {
    it('scanHistory is a defensive copy', () => {
      const t = make();
      const h = t.scanHistory;
      h.push(scanEvent());
      expect(t.scanHistory).toHaveLength(0);
    });
  });
});
