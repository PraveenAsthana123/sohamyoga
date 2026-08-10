import { QrLoginChallenge } from '../../../domain/identity/QrLoginChallenge';

const NOW    = new Date('2026-08-05T10:00:00Z');
const LATER  = new Date('2026-08-05T10:01:30Z'); // +90s
const PAST   = new Date('2026-08-05T09:59:00Z');

function makeChallenge(ttlMs = 60_000) {
  return QrLoginChallenge.create(
    'ch-1',
    'a1b2c3d4e5f6' + 'a'.repeat(20),
    'browser-session-99',
    'Chrome on Windows / 192.168.1.42',
    'tenant-1',
    NOW,
    ttlMs,
  );
}

describe('QrLoginChallenge', () => {
  describe('create', () => {
    it('creates with pending status', () => {
      const c = makeChallenge();
      expect(c.status).toBe('pending');
      expect(c.approvedBySessionId).toBeNull();
      expect(c.usedAt).toBeNull();
    });

    it('sets expiresAt = createdAt + ttlMs', () => {
      const c = makeChallenge(60_000);
      expect(c.expiresAt.getTime()).toBe(NOW.getTime() + 60_000);
    });

    it('throws on blank challengeToken', () => {
      expect(() =>
        new QrLoginChallenge({
          id: 'x', challengeToken: '', browserSessionId: 'b',
          deviceHint: 'd', approvedBySessionId: null,
          status: 'pending', createdAt: NOW,
          expiresAt: LATER, usedAt: null, tenantId: 't',
        })
      ).toThrow('challengeToken is required');
    });

    it('throws when expiresAt ≤ createdAt', () => {
      expect(() =>
        new QrLoginChallenge({
          id: 'x', challengeToken: 'tok', browserSessionId: 'b',
          deviceHint: 'd', approvedBySessionId: null,
          status: 'pending', createdAt: NOW,
          expiresAt: PAST, usedAt: null, tenantId: 't',
        })
      ).toThrow('expiresAt must be after createdAt');
    });
  });

  describe('isExpired', () => {
    it('returns false before expiry', () => {
      expect(makeChallenge(90_000).isExpired(NOW)).toBe(false);
    });

    it('returns true after expiry', () => {
      const c = makeChallenge(30_000);
      const afterExpiry = new Date(NOW.getTime() + 31_000);
      expect(c.isExpired(afterExpiry)).toBe(true);
    });
  });

  describe('approve', () => {
    it('transitions to approved with mobileSessionId', () => {
      const c = makeChallenge().approve('mobile-session-7');
      expect(c.status).toBe('approved');
      expect(c.approvedBySessionId).toBe('mobile-session-7');
    });

    it('throws on non-pending challenge', () => {
      const rejected = makeChallenge().reject();
      expect(() => rejected.approve('m')).toThrow("Cannot approve challenge with status 'rejected'");
    });

    it('throws on blank mobileSessionId', () => {
      expect(() => makeChallenge().approve('  ')).toThrow('mobileSessionId is required');
    });
  });

  describe('reject', () => {
    it('transitions to rejected', () => {
      expect(makeChallenge().reject().status).toBe('rejected');
    });

    it('throws rejecting a non-pending challenge', () => {
      expect(() => makeChallenge().approve('m').reject()).toThrow("Cannot reject challenge with status 'approved'");
    });
  });

  describe('markUsed', () => {
    it('marks approved challenge as used', () => {
      const c = makeChallenge().approve('m').markUsed(LATER);
      expect(c.status).toBe('used');
      expect(c.usedAt).toEqual(LATER);
    });

    it('throws if not approved', () => {
      expect(() => makeChallenge().markUsed(LATER)).toThrow('must be approved');
    });
  });

  describe('expire', () => {
    it('expires a pending challenge', () => {
      expect(makeChallenge().expire().status).toBe('expired');
    });

    it('throws expiring a used challenge', () => {
      const c = makeChallenge().approve('m').markUsed(LATER);
      expect(() => c.expire()).toThrow('Cannot expire a used challenge');
    });
  });

  describe('secondsRemaining', () => {
    it('returns correct seconds before expiry', () => {
      const c = makeChallenge(60_000);
      const halfwayThrough = new Date(NOW.getTime() + 30_000);
      expect(c.secondsRemaining(halfwayThrough)).toBe(30);
    });

    it('returns 0 when expired', () => {
      const c = makeChallenge(10_000);
      const afterExpiry = new Date(NOW.getTime() + 20_000);
      expect(c.secondsRemaining(afterExpiry)).toBe(0);
    });
  });

  describe('immutability', () => {
    it('returns new instances on state transitions', () => {
      const c = makeChallenge();
      const approved = c.approve('m');
      expect(c.status).toBe('pending');
      expect(approved.status).toBe('approved');
    });
  });
});
