// NotificationJob — a single notification send unit in the processing pipeline.
// One job = one recipient × one channel × one template render.
// All jobs stored locally in notification_queue. Novu/Listmonk/ntfy are adapters,
// never the system of record.

import type { NotificationChannel } from './NotificationTemplate';

export type NotificationJobStatus =
  | 'pending'     // created, waiting for worker pickup
  | 'scheduled'   // has a future scheduledAt, not yet due
  | 'processing'  // send call in-flight
  | 'sent'        // accepted by channel provider
  | 'failed'      // retries exhausted or fatal error
  | 'cancelled';  // manually cancelled

export const MAX_NOTIFICATION_RETRIES = 3;

export interface NotificationJobProps {
  id:                string;
  tenantId:          string;
  templateSlug:      string;
  channel:           NotificationChannel;
  type:              'transactional' | 'marketing' | 'reminder' | 'alert' | 'otp';
  recipientUserId:   string;
  recipientAddress:  string;    // email / phone / device token
  payload:           Readonly<Record<string, string>>;  // template variable values
  status:            NotificationJobStatus;
  scheduledAt?:      Date;
  sentAt?:           Date;
  failedAt?:         Date;
  cancelledAt?:      Date;
  retryCount:        number;
  lastRetryAt?:      Date;
  failureReason?:    string;
  idempotencyKey:    string;
  providerMessageId?: string;  // ID returned by Novu / Listmonk / ntfy after send
  createdAt:         Date;
  updatedAt:         Date;
}

export class NotificationJob {
  private readonly props: Readonly<NotificationJobProps>;

  constructor(props: NotificationJobProps) {
    if (!props.id)               throw new Error('id is required');
    if (!props.templateSlug)     throw new Error('templateSlug is required');
    if (!props.recipientUserId)  throw new Error('recipientUserId is required');
    if (!props.recipientAddress) throw new Error('recipientAddress is required');
    if (!props.idempotencyKey)   throw new Error('idempotencyKey is required');
    if (props.retryCount < 0 || !Number.isInteger(props.retryCount))
      throw new Error('retryCount must be a non-negative integer');
    this.props = Object.freeze({ ...props, payload: Object.freeze({ ...props.payload }) });
  }

  private clone(patch: Partial<NotificationJobProps>): NotificationJob {
    return new NotificationJob({ ...this.props, ...patch });
  }

  get id()                { return this.props.id; }
  get templateSlug()      { return this.props.templateSlug; }
  get channel()           { return this.props.channel; }
  get type()              { return this.props.type; }
  get recipientUserId()   { return this.props.recipientUserId; }
  get recipientAddress()  { return this.props.recipientAddress; }
  get payload()           { return { ...this.props.payload }; }
  get status()            { return this.props.status; }
  get scheduledAt()       { return this.props.scheduledAt; }
  get sentAt()            { return this.props.sentAt; }
  get failedAt()          { return this.props.failedAt; }
  get retryCount()        { return this.props.retryCount; }
  get lastRetryAt()       { return this.props.lastRetryAt; }
  get failureReason()     { return this.props.failureReason; }
  get idempotencyKey()    { return this.props.idempotencyKey; }
  get providerMessageId() { return this.props.providerMessageId; }
  get updatedAt()         { return this.props.updatedAt; }

  // ── State helpers ─────────────────────────────────────────────────────────

  isPending():    boolean { return this.props.status === 'pending'; }
  isScheduled():  boolean { return this.props.status === 'scheduled'; }
  isSent():       boolean { return this.props.status === 'sent'; }
  isFailed():     boolean { return this.props.status === 'failed'; }
  isCancelled():  boolean { return this.props.status === 'cancelled'; }

  canRetry(): boolean {
    return this.props.status === 'failed' && this.props.retryCount < MAX_NOTIFICATION_RETRIES;
  }

  isDue(now: Date): boolean {
    if (this.props.status === 'pending') return true;
    if (this.props.status === 'scheduled' && this.props.scheduledAt)
      return this.props.scheduledAt <= now;
    return false;
  }

  // ── State transitions ─────────────────────────────────────────────────────

  /** Schedule for future delivery (pending → scheduled) */
  schedule(scheduledAt: Date, at: Date): NotificationJob {
    if (this.props.status !== 'pending')
      throw new Error(`Can only schedule pending jobs, current status: ${this.props.status}`);
    if (!scheduledAt) throw new Error('scheduledAt is required');
    return this.clone({ status: 'scheduled', scheduledAt, updatedAt: at });
  }

  /** Worker picks up the job (pending|scheduled → processing) */
  markProcessing(at: Date): NotificationJob {
    if (!['pending', 'scheduled'].includes(this.props.status))
      throw new Error(`Cannot start processing from status: ${this.props.status}`);
    return this.clone({ status: 'processing', updatedAt: at });
  }

  /** Channel provider accepted the message (processing → sent) */
  markSent(providerMessageId: string, at: Date): NotificationJob {
    if (this.props.status !== 'processing')
      throw new Error(`Cannot mark sent from status: ${this.props.status}`);
    return this.clone({ status: 'sent', sentAt: at, providerMessageId, updatedAt: at });
  }

  /** Send failed (processing → failed) */
  markFailed(reason: string, at: Date): NotificationJob {
    if (this.props.status !== 'processing')
      throw new Error(`Cannot mark failed from status: ${this.props.status}`);
    return this.clone({ status: 'failed', failedAt: at, failureReason: reason, updatedAt: at });
  }

  /** Retry after failure (failed → pending, increments retryCount) */
  retry(at: Date): NotificationJob {
    if (!this.canRetry())
      throw new Error(
        this.props.retryCount >= MAX_NOTIFICATION_RETRIES
          ? `Max retries (${MAX_NOTIFICATION_RETRIES}) reached`
          : `Cannot retry from status: ${this.props.status}`,
      );
    return this.clone({
      status:        'pending',
      retryCount:    this.props.retryCount + 1,
      lastRetryAt:   at,
      failureReason: undefined,
      failedAt:      undefined,
      updatedAt:     at,
    });
  }

  /** Cancel a job that has not yet been sent */
  cancel(at: Date): NotificationJob {
    if (this.props.status === 'sent')
      throw new Error('Cannot cancel an already-sent notification');
    if (this.props.status === 'cancelled')
      throw new Error('Notification is already cancelled');
    if (this.props.status === 'processing')
      throw new Error('Cannot cancel a notification that is currently processing');
    return this.clone({ status: 'cancelled', cancelledAt: at, updatedAt: at });
  }

  /** Record provider message ID after async callback (sent only) */
  recordProviderMessageId(providerMessageId: string, at: Date): NotificationJob {
    if (!providerMessageId) throw new Error('providerMessageId is required');
    return this.clone({ providerMessageId, updatedAt: at });
  }
}
