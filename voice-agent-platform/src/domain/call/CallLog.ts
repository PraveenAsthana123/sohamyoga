export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'no_answer';

export interface CallLogProps {
  id: string;
  direction: CallDirection;
  contactId: string | null;
  scriptVersionId: string | null;
  status: CallStatus;
  durationSeconds: number | null;
  startedAt: Date | null;
  endedAt: Date | null;
  outcomeNotes: string | null;
  provider: string;
  createdBy: string;
  createdAt: Date;
  externalCallId: string | null;
  needsFollowUp: boolean;
  costUsd: number | null;
  transcript: string | null;
  recordingUrl: string | null;
  endedReason: string | null;
  qualityScore: number | null;
  isIncident: boolean;
  incidentNotes: string | null;
}

export class CallLog {
  private readonly props: CallLogProps;

  constructor(props: CallLogProps) {
    if (props.durationSeconds !== null && props.durationSeconds < 0) throw new Error('durationSeconds cannot be negative');
    if (props.startedAt && props.endedAt && props.endedAt < props.startedAt) {
      throw new Error('endedAt cannot be before startedAt');
    }
    if (props.qualityScore !== null && (props.qualityScore < 1 || props.qualityScore > 5)) {
      throw new Error('qualityScore must be between 1 and 5');
    }
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get direction() { return this.props.direction; }
  get status() { return this.props.status; }
  get contactId() { return this.props.contactId; }
  get scriptVersionId() { return this.props.scriptVersionId; }
  get provider() { return this.props.provider; }
  get durationSeconds() { return this.props.durationSeconds; }
  get externalCallId() { return this.props.externalCallId; }
  get needsFollowUp() { return this.props.needsFollowUp; }
  get costUsd() { return this.props.costUsd; }
  get transcript() { return this.props.transcript; }
  get qualityScore() { return this.props.qualityScore; }
  get isIncident() { return this.props.isIncident; }

  complete(outcomeNotes: string | null, durationSeconds: number | null): CallLog {
    return new CallLog({ ...this.props, status: 'completed', outcomeNotes, durationSeconds, endedAt: new Date() });
  }

  /** Human QA review -- never ML/sentiment-derived, always an explicit
   * admin judgment call, recorded as such. */
  setQualityReview(review: { qualityScore: number | null; isIncident: boolean; incidentNotes: string | null }): CallLog {
    return new CallLog({ ...this.props, ...review });
  }

  /** Applied only by the Vapi webhook receiver once a real call actually ends. */
  applyWebhookReport(report: {
    status: CallStatus; durationSeconds: number | null; endedAt: Date;
    costUsd: number | null; transcript: string | null; recordingUrl: string | null; endedReason: string | null;
  }): CallLog {
    return new CallLog({ ...this.props, ...report });
  }

  toJSON(): CallLogProps {
    return { ...this.props };
  }
}
