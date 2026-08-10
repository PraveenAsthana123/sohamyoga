// QrLoginChallenge: lets an already-authenticated phone user sign into a kiosk/TV.
// The QR encodes only a random challenge token — never a password or session token.
// Expires in 30-90 seconds, one-time use, tied to one browser session.

export type QrChallengeStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'used';

const DEFAULT_TTL_MS = 60_000; // 60 seconds

export interface QrLoginChallengeProps {
  id:                   string;
  challengeToken:       string;   // random 32-byte hex encoded in the QR
  browserSessionId:     string;   // the kiosk browser session awaiting login
  deviceHint:           string;   // "Chrome on Windows / 192.168.1.x"
  approvedBySessionId:  string | null;  // authenticated mobile session that approved
  status:               QrChallengeStatus;
  createdAt:            Date;
  expiresAt:            Date;     // createdAt + ttlMs
  usedAt:               Date | null;
  tenantId:             string;
}

export class QrLoginChallenge {
  private readonly props: Readonly<QrLoginChallengeProps>;

  static create(
    id: string,
    challengeToken: string,
    browserSessionId: string,
    deviceHint: string,
    tenantId: string,
    createdAt: Date,
    ttlMs = DEFAULT_TTL_MS,
  ): QrLoginChallenge {
    return new QrLoginChallenge({
      id,
      challengeToken,
      browserSessionId,
      deviceHint,
      approvedBySessionId: null,
      status: 'pending',
      createdAt,
      expiresAt: new Date(createdAt.getTime() + ttlMs),
      usedAt: null,
      tenantId,
    });
  }

  constructor(props: QrLoginChallengeProps) {
    if (!props.id.trim())             throw new Error('id is required');
    if (!props.challengeToken.trim()) throw new Error('challengeToken is required');
    if (!props.browserSessionId.trim()) throw new Error('browserSessionId is required');
    if (!props.tenantId.trim())       throw new Error('tenantId is required');
    if (props.expiresAt <= props.createdAt) throw new Error('expiresAt must be after createdAt');

    this.props = { ...props };
  }

  private clone(patch: Partial<QrLoginChallengeProps>): QrLoginChallenge {
    return new QrLoginChallenge({ ...this.props, ...patch });
  }

  get id()                  { return this.props.id; }
  get challengeToken()      { return this.props.challengeToken; }
  get browserSessionId()    { return this.props.browserSessionId; }
  get deviceHint()          { return this.props.deviceHint; }
  get approvedBySessionId() { return this.props.approvedBySessionId; }
  get status()              { return this.props.status; }
  get createdAt()           { return this.props.createdAt; }
  get expiresAt()           { return this.props.expiresAt; }
  get usedAt()              { return this.props.usedAt; }
  get tenantId()            { return this.props.tenantId; }

  isExpired(now: Date): boolean {
    return now >= this.props.expiresAt || this.props.status === 'expired';
  }

  isPending(): boolean { return this.props.status === 'pending'; }
  isApproved(): boolean { return this.props.status === 'approved'; }

  approve(mobileSessionId: string): QrLoginChallenge {
    if (this.props.status !== 'pending') throw new Error(`Cannot approve challenge with status '${this.props.status}'`);
    if (!mobileSessionId.trim())         throw new Error('mobileSessionId is required');
    return this.clone({ status: 'approved', approvedBySessionId: mobileSessionId });
  }

  reject(): QrLoginChallenge {
    if (this.props.status !== 'pending') throw new Error(`Cannot reject challenge with status '${this.props.status}'`);
    return this.clone({ status: 'rejected' });
  }

  markUsed(at: Date): QrLoginChallenge {
    if (this.props.status !== 'approved') throw new Error('Challenge must be approved before it can be used');
    return this.clone({ status: 'used', usedAt: at });
  }

  expire(): QrLoginChallenge {
    if (this.props.status === 'used') throw new Error('Cannot expire a used challenge');
    return this.clone({ status: 'expired' });
  }

  secondsRemaining(now: Date): number {
    return Math.max(0, Math.floor((this.props.expiresAt.getTime() - now.getTime()) / 1000));
  }

  toJSON(): QrLoginChallengeProps {
    return { ...this.props };
  }
}
