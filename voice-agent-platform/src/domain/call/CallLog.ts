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
}

export class CallLog {
  private readonly props: CallLogProps;

  constructor(props: CallLogProps) {
    if (props.durationSeconds !== null && props.durationSeconds < 0) throw new Error('durationSeconds cannot be negative');
    if (props.startedAt && props.endedAt && props.endedAt < props.startedAt) {
      throw new Error('endedAt cannot be before startedAt');
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

  complete(outcomeNotes: string | null, durationSeconds: number | null): CallLog {
    return new CallLog({ ...this.props, status: 'completed', outcomeNotes, durationSeconds, endedAt: new Date() });
  }

  toJSON(): CallLogProps {
    return { ...this.props };
  }
}
