import { describe, it, expect } from '@jest/globals';
import {
  NotificationJob,
  MAX_NOTIFICATION_RETRIES,
  type NotificationJobProps,
} from '../../../domain/notification/NotificationJob';

const T0 = new Date('2026-01-01T00:00:00Z');
const T1 = new Date('2026-01-02T00:00:00Z');
const T2 = new Date('2026-01-03T00:00:00Z');
const FUTURE = new Date('2026-12-31T00:00:00Z');

function makeJob(overrides: Partial<NotificationJobProps> = {}): NotificationJob {
  return new NotificationJob({
    id:               'nj-1',
    tenantId:         'tenant-1',
    templateSlug:     'booking_reminder_email',
    channel:          'email',
    type:             'reminder',
    recipientUserId:  'u-1',
    recipientAddress: 'student@example.com',
    payload:          { name: 'Priya', class_name: 'Hatha Yoga', class_time: '7:00 AM' },
    status:           'pending',
    retryCount:       0,
    idempotencyKey:   'idem-key-1',
    createdAt:        T0,
    updatedAt:        T0,
    ...overrides,
  });
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe('NotificationJob — constructor', () => {
  it('creates a valid pending job', () => {
    const j = makeJob();
    expect(j.id).toBe('nj-1');
    expect(j.status).toBe('pending');
    expect(j.retryCount).toBe(0);
  });

  it('throws if id is missing', () => {
    expect(() => makeJob({ id: '' })).toThrow('id is required');
  });

  it('throws if templateSlug is missing', () => {
    expect(() => makeJob({ templateSlug: '' })).toThrow('templateSlug is required');
  });

  it('throws if recipientUserId is missing', () => {
    expect(() => makeJob({ recipientUserId: '' })).toThrow('recipientUserId is required');
  });

  it('throws if recipientAddress is missing', () => {
    expect(() => makeJob({ recipientAddress: '' })).toThrow('recipientAddress is required');
  });

  it('throws if idempotencyKey is missing', () => {
    expect(() => makeJob({ idempotencyKey: '' })).toThrow('idempotencyKey is required');
  });

  it('throws if retryCount is negative', () => {
    expect(() => makeJob({ retryCount: -1 })).toThrow('retryCount must be a non-negative integer');
  });

  it('throws if retryCount is a float', () => {
    expect(() => makeJob({ retryCount: 1.5 })).toThrow('retryCount must be a non-negative integer');
  });

  it('payload getter returns a copy', () => {
    const j = makeJob();
    const p = j.payload;
    p.extra = 'injected';
    expect(j.payload.extra).toBeUndefined();
  });
});

// ── MAX_NOTIFICATION_RETRIES ──────────────────────────────────────────────────

describe('MAX_NOTIFICATION_RETRIES', () => {
  it('is 3', () => {
    expect(MAX_NOTIFICATION_RETRIES).toBe(3);
  });
});

// ── State helpers ─────────────────────────────────────────────────────────────

describe('NotificationJob — state helpers', () => {
  it('isPending() true when pending', () => {
    expect(makeJob().isPending()).toBe(true);
  });

  it('isScheduled() true when scheduled', () => {
    expect(makeJob({ status: 'scheduled', scheduledAt: FUTURE }).isScheduled()).toBe(true);
  });

  it('isSent() true when sent', () => {
    expect(makeJob({ status: 'sent', sentAt: T1 }).isSent()).toBe(true);
  });

  it('isFailed() true when failed', () => {
    expect(makeJob({ status: 'failed' }).isFailed()).toBe(true);
  });
});

// ── isDue() ───────────────────────────────────────────────────────────────────

describe('NotificationJob — isDue()', () => {
  it('pending job is always due', () => {
    expect(makeJob().isDue(T0)).toBe(true);
  });

  it('scheduled job is due when scheduledAt <= now', () => {
    const j = makeJob({ status: 'scheduled', scheduledAt: T1 });
    expect(j.isDue(T1)).toBe(true);
    expect(j.isDue(T2)).toBe(true);
  });

  it('scheduled job is not due before scheduledAt', () => {
    const j = makeJob({ status: 'scheduled', scheduledAt: T2 });
    expect(j.isDue(T0)).toBe(false);
    expect(j.isDue(T1)).toBe(false);
  });

  it('sent job is never due', () => {
    expect(makeJob({ status: 'sent', sentAt: T1 }).isDue(T2)).toBe(false);
  });
});

// ── canRetry() ────────────────────────────────────────────────────────────────

describe('NotificationJob — canRetry()', () => {
  it('true when failed with retryCount 0', () => {
    expect(makeJob({ status: 'failed' }).canRetry()).toBe(true);
  });

  it('true when failed with retryCount MAX-1', () => {
    expect(makeJob({ status: 'failed', retryCount: MAX_NOTIFICATION_RETRIES - 1 }).canRetry()).toBe(true);
  });

  it('false when failed with retryCount = MAX', () => {
    expect(makeJob({ status: 'failed', retryCount: MAX_NOTIFICATION_RETRIES }).canRetry()).toBe(false);
  });

  it('false when pending (not failed)', () => {
    expect(makeJob().canRetry()).toBe(false);
  });
});

// ── schedule() ────────────────────────────────────────────────────────────────

describe('NotificationJob — schedule()', () => {
  it('transitions pending → scheduled', () => {
    const j2 = makeJob().schedule(FUTURE, T0);
    expect(j2.status).toBe('scheduled');
    expect(j2.scheduledAt).toEqual(FUTURE);
    expect(j2.updatedAt).toEqual(T0);
  });

  it('throws if not pending', () => {
    expect(() => makeJob({ status: 'scheduled', scheduledAt: FUTURE }).schedule(FUTURE, T1))
      .toThrow('Can only schedule pending jobs');
  });

  it('does not mutate original', () => {
    const j = makeJob();
    j.schedule(FUTURE, T0);
    expect(j.status).toBe('pending');
  });
});

// ── markProcessing() ─────────────────────────────────────────────────────────

describe('NotificationJob — markProcessing()', () => {
  it('transitions pending → processing', () => {
    const j2 = makeJob().markProcessing(T1);
    expect(j2.status).toBe('processing');
  });

  it('transitions scheduled → processing', () => {
    const j2 = makeJob({ status: 'scheduled', scheduledAt: FUTURE }).markProcessing(T1);
    expect(j2.status).toBe('processing');
  });

  it('throws if already sent', () => {
    expect(() => makeJob({ status: 'sent', sentAt: T1 }).markProcessing(T2))
      .toThrow('Cannot start processing from status: sent');
  });
});

// ── markSent() ────────────────────────────────────────────────────────────────

describe('NotificationJob — markSent()', () => {
  it('transitions processing → sent', () => {
    const j2 = makeJob({ status: 'processing' }).markSent('msg-abc', T1);
    expect(j2.status).toBe('sent');
    expect(j2.sentAt).toEqual(T1);
    expect(j2.providerMessageId).toBe('msg-abc');
  });

  it('throws if not processing', () => {
    expect(() => makeJob().markSent('msg', T1)).toThrow('Cannot mark sent from status: pending');
  });
});

// ── markFailed() ─────────────────────────────────────────────────────────────

describe('NotificationJob — markFailed()', () => {
  it('transitions processing → failed', () => {
    const j2 = makeJob({ status: 'processing' }).markFailed('SMTP timeout', T1);
    expect(j2.status).toBe('failed');
    expect(j2.failureReason).toBe('SMTP timeout');
  });

  it('throws if not processing', () => {
    expect(() => makeJob().markFailed('reason', T1)).toThrow('Cannot mark failed from status: pending');
  });
});

// ── retry() ───────────────────────────────────────────────────────────────────

describe('NotificationJob — retry()', () => {
  it('failed → pending, increments retryCount', () => {
    const j2 = makeJob({ status: 'failed' }).retry(T1);
    expect(j2.status).toBe('pending');
    expect(j2.retryCount).toBe(1);
    expect(j2.lastRetryAt).toEqual(T1);
    expect(j2.failureReason).toBeUndefined();
  });

  it('clears failedAt on retry', () => {
    const j2 = makeJob({ status: 'failed', retryCount: 0 }).retry(T1);
    expect((j2 as NotificationJob & { props: any }).props?.failedAt).toBeUndefined();
  });

  it('allows retry up to MAX-1 times', () => {
    let j = makeJob({ status: 'failed', retryCount: MAX_NOTIFICATION_RETRIES - 1 });
    expect(() => j.retry(T1)).not.toThrow();
  });

  it('throws when retryCount equals MAX', () => {
    const j = makeJob({ status: 'failed', retryCount: MAX_NOTIFICATION_RETRIES });
    expect(() => j.retry(T1)).toThrow('Max retries');
  });

  it('throws when not failed', () => {
    expect(() => makeJob().retry(T1)).toThrow('Cannot retry');
  });

  it('does not mutate original', () => {
    const j = makeJob({ status: 'failed' });
    j.retry(T1);
    expect(j.status).toBe('failed');
    expect(j.retryCount).toBe(0);
  });
});

// ── cancel() ──────────────────────────────────────────────────────────────────

describe('NotificationJob — cancel()', () => {
  it('cancels a pending job', () => {
    const j2 = makeJob().cancel(T1);
    expect(j2.status).toBe('cancelled');
  });

  it('cancels a scheduled job', () => {
    const j2 = makeJob({ status: 'scheduled', scheduledAt: FUTURE }).cancel(T1);
    expect(j2.status).toBe('cancelled');
  });

  it('cancels a failed job', () => {
    const j2 = makeJob({ status: 'failed' }).cancel(T1);
    expect(j2.status).toBe('cancelled');
  });

  it('throws if already sent', () => {
    expect(() => makeJob({ status: 'sent', sentAt: T1 }).cancel(T2))
      .toThrow('Cannot cancel an already-sent notification');
  });

  it('throws if already cancelled', () => {
    expect(() => makeJob({ status: 'cancelled' }).cancel(T1))
      .toThrow('already cancelled');
  });

  it('throws if currently processing', () => {
    expect(() => makeJob({ status: 'processing' }).cancel(T1))
      .toThrow('Cannot cancel a notification that is currently processing');
  });
});
