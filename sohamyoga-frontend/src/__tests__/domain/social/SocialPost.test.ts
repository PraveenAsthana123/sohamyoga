import { describe, it, expect, beforeEach } from '@jest/globals';
import { SocialPost, MAX_RETRIES, type SocialPostProps } from '../../../domain/social/SocialPost';

const NOW   = new Date('2026-08-05T10:00:00Z');
const LATER = new Date('2026-08-05T11:00:00Z');
const PAST  = new Date('2026-08-05T09:00:00Z');

function make(overrides?: Partial<SocialPostProps>): SocialPost {
  return new SocialPost({
    id:             'post-1',
    workspaceId:    'ws-1',
    draftId:        'draft-1',
    platform:       'instagram',
    accountId:      'acct-1',
    idempotencyKey: 'idem-abc123',
    scheduledAt:    LATER,
    status:         'queued',
    retryCount:     0,
    createdAt:      NOW,
    updatedAt:      NOW,
    ...overrides,
  });
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe('SocialPost — constructor', () => {
  it('creates a queued post', () => {
    const p = make();
    expect(p.status).toBe('queued');
    expect(p.retryCount).toBe(0);
    expect(p.isQueued()).toBe(true);
  });

  it('throws when id is empty',             () => expect(() => make({ id: '' })).toThrow('id is required'));
  it('throws when draftId is empty',        () => expect(() => make({ draftId: '' })).toThrow('draftId is required'));
  it('throws when accountId is empty',      () => expect(() => make({ accountId: '' })).toThrow('accountId is required'));
  it('throws when idempotencyKey is empty', () => expect(() => make({ idempotencyKey: '' })).toThrow('idempotencyKey is required'));

  it('throws when retryCount is negative', () => {
    expect(() => make({ retryCount: -1 })).toThrow('non-negative integer');
  });

  it('throws when retryCount is non-integer', () => {
    expect(() => make({ retryCount: 1.5 })).toThrow('non-negative integer');
  });

  it('accepts retryCount of 0', () => {
    expect(() => make({ retryCount: 0 })).not.toThrow();
  });
});

// ── Status helpers ────────────────────────────────────────────────────────────

describe('status helpers', () => {
  it('isQueued()    — true when queued', () => expect(make().isQueued()).toBe(true));
  it('isPublished() — false when queued', () => expect(make().isPublished()).toBe(false));
  it('isFailed()    — false when queued', () => expect(make().isFailed()).toBe(false));
  it('isPaused()    — false when queued', () => expect(make().isPaused()).toBe(false));
  it('isCancelled() — false when queued', () => expect(make().isCancelled()).toBe(false));
});

// ── isDue() ───────────────────────────────────────────────────────────────────

describe('isDue()', () => {
  it('true when queued and scheduledAt <= now', () => {
    const p = make({ scheduledAt: PAST });
    expect(p.isDue(NOW)).toBe(true);
  });

  it('false when scheduledAt is in the future', () => {
    expect(make({ scheduledAt: LATER }).isDue(NOW)).toBe(false);
  });

  it('false when not queued', () => {
    const p = make({ scheduledAt: PAST, status: 'paused' });
    expect(p.isDue(NOW)).toBe(false);
  });
});

// ── canRetry() ────────────────────────────────────────────────────────────────

describe('canRetry()', () => {
  it('true when failed with retries remaining', () => {
    expect(make({ status: 'failed', retryCount: 1 }).canRetry()).toBe(true);
  });

  it('false when failed but MAX_RETRIES reached', () => {
    expect(make({ status: 'failed', retryCount: MAX_RETRIES }).canRetry()).toBe(false);
  });

  it('false when status is not failed', () => {
    expect(make({ status: 'queued', retryCount: 0 }).canRetry()).toBe(false);
  });
});

// ── markPublishing() ──────────────────────────────────────────────────────────

describe('markPublishing()', () => {
  it('queued → publishing', () => {
    const p = make().markPublishing(LATER);
    expect(p.status).toBe('publishing');
    expect(p.updatedAt).toEqual(LATER);
  });

  it('throws when not queued', () => {
    const p = make({ status: 'paused' });
    expect(() => p.markPublishing(LATER)).toThrow('Cannot start publishing');
  });
});

// ── markPublished() ───────────────────────────────────────────────────────────

describe('markPublished()', () => {
  it('publishing → published with external IDs', () => {
    const p = make({ status: 'publishing' })
      .markPublished('ext-123', 'https://instagram.com/p/ext-123', LATER);
    expect(p.status).toBe('published');
    expect(p.externalPostId).toBe('ext-123');
    expect(p.externalPostUrl).toBe('https://instagram.com/p/ext-123');
    expect(p.publishedAt).toEqual(LATER);
  });

  it('throws when not publishing', () => {
    expect(() => make().markPublished('id', 'url', LATER)).toThrow('Cannot mark published');
  });

  it('throws when externalPostId is empty', () => {
    expect(() => make({ status: 'publishing' }).markPublished('', 'url', LATER)).toThrow('externalPostId is required');
  });
});

// ── markFailed() ──────────────────────────────────────────────────────────────

describe('markFailed()', () => {
  it('publishing → failed', () => {
    const p = make({ status: 'publishing' }).markFailed('API error 429', LATER);
    expect(p.status).toBe('failed');
    expect(p.failureReason).toBe('API error 429');
  });

  it('queued → failed (e.g. pre-flight rejection)', () => {
    const p = make().markFailed('Account disconnected', LATER);
    expect(p.status).toBe('failed');
  });

  it('throws from published', () => {
    const p = make({ status: 'published' });
    expect(() => p.markFailed('oops', LATER)).toThrow('Cannot mark failed');
  });
});

// ── retry() ───────────────────────────────────────────────────────────────────

describe('retry()', () => {
  it('failed → queued with incremented retryCount', () => {
    const p = make({ status: 'failed', retryCount: 1 }).retry(LATER);
    expect(p.status).toBe('queued');
    expect(p.retryCount).toBe(2);
    expect(p.lastRetryAt).toEqual(LATER);
    expect(p.failureReason).toBeUndefined();
  });

  it('throws when MAX_RETRIES reached', () => {
    const p = make({ status: 'failed', retryCount: MAX_RETRIES });
    expect(() => p.retry(LATER)).toThrow(`Max retries (${MAX_RETRIES}) reached`);
  });

  it('throws when status is not failed', () => {
    expect(() => make({ status: 'queued' }).retry(LATER)).toThrow('Cannot retry');
  });

  it('exact boundary: retryCount 2 (MAX-1) can retry', () => {
    const p = make({ status: 'failed', retryCount: MAX_RETRIES - 1 }).retry(LATER);
    expect(p.retryCount).toBe(MAX_RETRIES);
    expect(p.canRetry()).toBe(false);
  });
});

// ── pause() / resume() ────────────────────────────────────────────────────────

describe('pause() / resume()', () => {
  it('queued → paused', () => {
    const p = make().pause(LATER);
    expect(p.status).toBe('paused');
    expect(p.isPaused()).toBe(true);
  });

  it('throws pause when not queued', () => {
    expect(() => make({ status: 'published' }).pause(LATER)).toThrow('Can only pause queued posts');
  });

  it('paused → queued on resume', () => {
    const p = make({ status: 'paused' }).resume(LATER);
    expect(p.status).toBe('queued');
    expect(p.isQueued()).toBe(true);
  });

  it('throws resume when not paused', () => {
    expect(() => make().resume(LATER)).toThrow('Can only resume paused posts');
  });
});

// ── cancel() ─────────────────────────────────────────────────────────────────

describe('cancel()', () => {
  it('queued → cancelled', () => {
    const p = make().cancel(LATER);
    expect(p.status).toBe('cancelled');
    expect(p.isCancelled()).toBe(true);
  });

  it('paused → cancelled', () => {
    expect(make({ status: 'paused' }).cancel(LATER).status).toBe('cancelled');
  });

  it('failed → cancelled', () => {
    expect(make({ status: 'failed', retryCount: 3 }).cancel(LATER).status).toBe('cancelled');
  });

  it('throws when already cancelled', () => {
    expect(() => make({ status: 'cancelled' }).cancel(LATER)).toThrow('already cancelled');
  });

  it('throws when already published', () => {
    expect(() => make({ status: 'published' }).cancel(LATER)).toThrow('Cannot cancel');
  });
});

// ── assignPostizJob() ─────────────────────────────────────────────────────────

describe('assignPostizJob()', () => {
  it('assigns job ID', () => {
    const p = make().assignPostizJob('postiz-job-999', LATER);
    expect(p.postizJobId).toBe('postiz-job-999');
    expect(p.updatedAt).toEqual(LATER);
  });

  it('throws when jobId is empty', () => {
    expect(() => make().assignPostizJob('', LATER)).toThrow('postizJobId is required');
  });
});

// ── Immutability ──────────────────────────────────────────────────────────────

describe('immutability', () => {
  it('markPublishing does not mutate original', () => {
    const original = make();
    original.markPublishing(LATER);
    expect(original.status).toBe('queued');
  });

  it('retry does not mutate original', () => {
    const original = make({ status: 'failed', retryCount: 1 });
    original.retry(LATER);
    expect(original.retryCount).toBe(1);
  });
});
