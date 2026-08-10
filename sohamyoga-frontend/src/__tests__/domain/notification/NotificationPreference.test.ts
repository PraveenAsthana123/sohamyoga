import { describe, it, expect } from '@jest/globals';
import {
  NotificationPreference,
  type NotificationPreferenceProps,
} from '../../../domain/notification/NotificationPreference';

const T0 = new Date('2026-01-01T00:00:00Z');
const T1 = new Date('2026-01-02T00:00:00Z');

function makePreference(overrides: Partial<NotificationPreferenceProps> = {}): NotificationPreference {
  return new NotificationPreference({
    id:                  'pref-1',
    tenantId:            'tenant-1',
    userId:              'u-1',
    emailEnabled:        true,
    smsEnabled:          false,
    pushEnabled:         true,
    whatsappEnabled:     false,
    inAppEnabled:        true,
    telegramEnabled:     false,
    marketingEnabled:    false,
    transactionalEnabled:true,
    reminderEnabled:     true,
    alertEnabled:        true,
    language:            'en',
    timezone:            'America/Toronto',
    updatedAt:           T0,
    ...overrides,
  });
}

// ── Constructor validation ─────────────────────────────────────────────────────

describe('NotificationPreference — constructor', () => {
  it('creates a valid preference record', () => {
    const p = makePreference();
    expect(p.id).toBe('pref-1');
    expect(p.userId).toBe('u-1');
    expect(p.language).toBe('en');
  });

  it('throws if id is missing', () => {
    expect(() => makePreference({ id: '' })).toThrow('id is required');
  });

  it('throws if userId is missing', () => {
    expect(() => makePreference({ userId: '' })).toThrow('userId is required');
  });

  it('throws if tenantId is missing', () => {
    expect(() => makePreference({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws if timezone is missing', () => {
    expect(() => makePreference({ timezone: '' })).toThrow('timezone is required');
  });

  it('throws if quietHoursStart is not HH:MM', () => {
    expect(() => makePreference({ quietHoursStart: '2200', quietHoursEnd: '08:00' }))
      .toThrow('quietHoursStart must be HH:MM format');
  });

  it('throws if quietHoursEnd is not HH:MM', () => {
    expect(() => makePreference({ quietHoursStart: '22:00', quietHoursEnd: 'bad' }))
      .toThrow('quietHoursEnd must be HH:MM format');
  });

  it('throws if only one of quietHours pair is set', () => {
    expect(() => makePreference({ quietHoursStart: '22:00' }))
      .toThrow('Both quietHoursStart and quietHoursEnd must be set together');
  });

  it('accepts valid quiet hours pair', () => {
    const p = makePreference({ quietHoursStart: '22:00', quietHoursEnd: '08:00' });
    expect(p).toBeDefined();
  });
});

// ── isChannelEnabled() ────────────────────────────────────────────────────────

describe('NotificationPreference — isChannelEnabled()', () => {
  it('returns true for email when enabled', () => {
    expect(makePreference({ emailEnabled: true }).isChannelEnabled('email')).toBe(true);
  });

  it('returns false for email when disabled', () => {
    expect(makePreference({ emailEnabled: false }).isChannelEnabled('email')).toBe(false);
  });

  it('returns false for sms when disabled', () => {
    expect(makePreference().isChannelEnabled('sms')).toBe(false);
  });

  it('returns true for push when enabled', () => {
    expect(makePreference().isChannelEnabled('push')).toBe(true);
  });

  it('returns true for in_app when enabled', () => {
    expect(makePreference().isChannelEnabled('in_app')).toBe(true);
  });

  it('returns false for whatsapp when disabled', () => {
    expect(makePreference().isChannelEnabled('whatsapp')).toBe(false);
  });

  it('returns false for unsupported channel (discord)', () => {
    expect(makePreference().isChannelEnabled('discord')).toBe(false);
  });
});

// ── isTypeEnabled() ───────────────────────────────────────────────────────────

describe('NotificationPreference — isTypeEnabled()', () => {
  it('returns true for transactional when enabled', () => {
    expect(makePreference().isTypeEnabled('transactional')).toBe(true);
  });

  it('returns false for marketing when disabled', () => {
    expect(makePreference({ marketingEnabled: false }).isTypeEnabled('marketing')).toBe(false);
  });

  it('returns true for marketing when enabled', () => {
    expect(makePreference({ marketingEnabled: true }).isTypeEnabled('marketing')).toBe(true);
  });

  it('OTP follows transactional flag', () => {
    expect(makePreference({ transactionalEnabled: true }).isTypeEnabled('otp')).toBe(true);
    expect(makePreference({ transactionalEnabled: false }).isTypeEnabled('otp')).toBe(false);
  });

  it('returns true for reminder when enabled', () => {
    expect(makePreference().isTypeEnabled('reminder')).toBe(true);
  });

  it('returns true for alert when enabled', () => {
    expect(makePreference().isTypeEnabled('alert')).toBe(true);
  });
});

// ── isInQuietHours() ─────────────────────────────────────────────────────────

describe('NotificationPreference — isInQuietHours()', () => {
  it('returns false if no quiet hours set', () => {
    expect(makePreference().isInQuietHours('23:00')).toBe(false);
  });

  // Same-day window (22:00–23:59) — user sleeps late
  it('true when inside same-day quiet window', () => {
    const p = makePreference({ quietHoursStart: '22:00', quietHoursEnd: '23:00' });
    expect(p.isInQuietHours('22:30')).toBe(true);
  });

  it('false when outside same-day quiet window', () => {
    const p = makePreference({ quietHoursStart: '22:00', quietHoursEnd: '23:00' });
    expect(p.isInQuietHours('21:00')).toBe(false);
    expect(p.isInQuietHours('23:30')).toBe(false);
  });

  // Overnight window (22:00–08:00)
  it('true after start of overnight quiet window', () => {
    const p = makePreference({ quietHoursStart: '22:00', quietHoursEnd: '08:00' });
    expect(p.isInQuietHours('23:00')).toBe(true);
  });

  it('true at midnight during overnight window', () => {
    const p = makePreference({ quietHoursStart: '22:00', quietHoursEnd: '08:00' });
    expect(p.isInQuietHours('00:00')).toBe(true);
  });

  it('true early morning before end of overnight window', () => {
    const p = makePreference({ quietHoursStart: '22:00', quietHoursEnd: '08:00' });
    expect(p.isInQuietHours('07:30')).toBe(true);
  });

  it('false during daytime outside overnight window', () => {
    const p = makePreference({ quietHoursStart: '22:00', quietHoursEnd: '08:00' });
    expect(p.isInQuietHours('12:00')).toBe(false);
    expect(p.isInQuietHours('09:00')).toBe(false);
  });

  it('true at exact start boundary', () => {
    const p = makePreference({ quietHoursStart: '22:00', quietHoursEnd: '08:00' });
    expect(p.isInQuietHours('22:00')).toBe(true);
  });

  it('true at exact end boundary', () => {
    const p = makePreference({ quietHoursStart: '22:00', quietHoursEnd: '08:00' });
    expect(p.isInQuietHours('08:00')).toBe(true);
  });
});

// ── update() ──────────────────────────────────────────────────────────────────

describe('NotificationPreference — update()', () => {
  it('enables marketing and returns new instance', () => {
    const p2 = makePreference().update({ marketingEnabled: true }, T1);
    expect(p2.isTypeEnabled('marketing')).toBe(true);
    expect(p2.updatedAt).toEqual(T1);
  });

  it('updates language', () => {
    const p2 = makePreference().update({ language: 'fr' }, T1);
    expect(p2.language).toBe('fr');
  });

  it('sets quiet hours', () => {
    const p2 = makePreference().update({ quietHoursStart: '22:00', quietHoursEnd: '07:00' }, T1);
    expect(p2.isInQuietHours('23:00')).toBe(true);
  });

  it('does not mutate original', () => {
    const p = makePreference();
    p.update({ marketingEnabled: true }, T1);
    expect(p.isTypeEnabled('marketing')).toBe(false);
  });
});
