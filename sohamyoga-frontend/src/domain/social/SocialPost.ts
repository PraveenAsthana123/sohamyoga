// Per-platform post — one ContentDraft produces one SocialPost per target platform.
// Tracks publish lifecycle, retries, and idempotency for the Postiz/custom connector layer.

import type { SocialPlatform } from './SocialAccount';

export type SocialPostStatus =
  | 'queued'       // approved + scheduled, waiting for publish window
  | 'publishing'   // publish call in-flight
  | 'published'    // successfully posted to platform
  | 'failed'       // all retries exhausted or fatal error
  | 'cancelled'    // manually cancelled or account disconnected
  | 'paused';      // campaign was paused before this post ran

export const MAX_RETRIES = 3;

export interface SocialPostProps {
  id: string;
  workspaceId: string;
  draftId: string;          // parent ContentDraft
  campaignId?: string;
  platform: SocialPlatform;
  accountId: string;        // SocialAccount.id
  postizJobId?: string;     // Postiz-assigned job ID after queuing
  scheduledAt: Date;
  publishedAt?: Date;
  cancelledAt?: Date;
  status: SocialPostStatus;
  retryCount: number;
  lastRetryAt?: Date;
  externalPostId?: string;  // platform-native ID after successful publish
  externalPostUrl?: string;
  failureReason?: string;
  idempotencyKey: string;   // prevents duplicate publishes on retry
  createdAt: Date;
  updatedAt: Date;
}

export class SocialPost {
  private readonly props: Readonly<SocialPostProps>;

  constructor(props: SocialPostProps) {
    if (!props.id)             throw new Error('id is required');
    if (!props.draftId)        throw new Error('draftId is required');
    if (!props.accountId)      throw new Error('accountId is required');
    if (!props.idempotencyKey) throw new Error('idempotencyKey is required');
    if (props.retryCount < 0 || !Number.isInteger(props.retryCount))
      throw new Error('retryCount must be a non-negative integer');
    this.props = Object.freeze({ ...props });
  }

  private clone(patch: Partial<SocialPostProps>): SocialPost {
    return new SocialPost({ ...this.props, ...patch });
  }

  get id()               { return this.props.id; }
  get draftId()          { return this.props.draftId; }
  get campaignId()       { return this.props.campaignId; }
  get platform()         { return this.props.platform; }
  get accountId()        { return this.props.accountId; }
  get postizJobId()      { return this.props.postizJobId; }
  get scheduledAt()      { return this.props.scheduledAt; }
  get publishedAt()      { return this.props.publishedAt; }
  get status()           { return this.props.status; }
  get retryCount()       { return this.props.retryCount; }
  get lastRetryAt()      { return this.props.lastRetryAt; }
  get externalPostId()   { return this.props.externalPostId; }
  get externalPostUrl()  { return this.props.externalPostUrl; }
  get failureReason()    { return this.props.failureReason; }
  get idempotencyKey()   { return this.props.idempotencyKey; }
  get updatedAt()        { return this.props.updatedAt; }

  // ── State helpers ─────────────────────────────────────────────────────────

  isPublished():  boolean { return this.props.status === 'published'; }
  isFailed():     boolean { return this.props.status === 'failed'; }
  isQueued():     boolean { return this.props.status === 'queued'; }
  isPaused():     boolean { return this.props.status === 'paused'; }
  isCancelled():  boolean { return this.props.status === 'cancelled'; }

  canRetry(): boolean {
    return this.props.status === 'failed' && this.props.retryCount < MAX_RETRIES;
  }

  isDue(now: Date): boolean {
    return this.props.status === 'queued' && this.props.scheduledAt <= now;
  }

  // ── State transitions ─────────────────────────────────────────────────────

  markPublishing(at: Date): SocialPost {
    if (this.props.status !== 'queued')
      throw new Error(`Cannot start publishing from status: ${this.props.status}`);
    return this.clone({ status: 'publishing', updatedAt: at });
  }

  markPublished(externalPostId: string, externalPostUrl: string, at: Date): SocialPost {
    if (this.props.status !== 'publishing')
      throw new Error(`Cannot mark published from status: ${this.props.status}`);
    if (!externalPostId) throw new Error('externalPostId is required when marking published');
    return this.clone({ status: 'published', publishedAt: at, externalPostId, externalPostUrl, updatedAt: at });
  }

  markFailed(reason: string, at: Date): SocialPost {
    if (!['publishing', 'queued'].includes(this.props.status))
      throw new Error(`Cannot mark failed from status: ${this.props.status}`);
    return this.clone({ status: 'failed', failureReason: reason, updatedAt: at });
  }

  retry(at: Date): SocialPost {
    if (!this.canRetry())
      throw new Error(this.props.retryCount >= MAX_RETRIES
        ? `Max retries (${MAX_RETRIES}) reached`
        : `Cannot retry from status: ${this.props.status}`);
    return this.clone({
      status:       'queued',
      retryCount:   this.props.retryCount + 1,
      lastRetryAt:  at,
      failureReason: undefined,
      updatedAt:    at,
    });
  }

  pause(at: Date): SocialPost {
    if (this.props.status !== 'queued')
      throw new Error(`Can only pause queued posts, current status: ${this.props.status}`);
    return this.clone({ status: 'paused', updatedAt: at });
  }

  resume(at: Date): SocialPost {
    if (this.props.status !== 'paused')
      throw new Error('Can only resume paused posts');
    return this.clone({ status: 'queued', updatedAt: at });
  }

  cancel(at: Date): SocialPost {
    if (this.props.status === 'published')
      throw new Error('Cannot cancel an already-published post');
    if (this.props.status === 'cancelled')
      throw new Error('Post is already cancelled');
    return this.clone({ status: 'cancelled', cancelledAt: at, updatedAt: at });
  }

  assignPostizJob(postizJobId: string, at: Date): SocialPost {
    if (!postizJobId) throw new Error('postizJobId is required');
    return this.clone({ postizJobId, updatedAt: at });
  }
}
