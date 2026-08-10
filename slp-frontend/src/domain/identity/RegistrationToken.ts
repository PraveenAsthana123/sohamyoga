// A RegistrationToken is the QR/barcode payload for check-in.
// It contains only a random token — no PII, no auth credentials.
// URL form: https://portal.sohamyoga.ca/checkin/<token>

export type RegistrationTokenType =
  | 'customer' | 'class_booking' | 'membership' | 'package'
  | 'workshop' | 'retreat' | 'teacher' | 'visitor' | 'family' | 'equipment';

export type RegistrationTokenStatus = 'active' | 'used' | 'expired' | 'revoked' | 'cancelled';

export type CheckInResult =
  | 'valid' | 'already_scanned' | 'wrong_class' | 'too_early'
  | 'expired_membership' | 'no_credits' | 'cancelled' | 'unknown_token'
  | 'offline_queued' | 'manual_override';

export interface CheckInEvent {
  scannedAt:   Date;
  scannedBy:   string;   // staff/teacher id
  deviceId:    string;
  result:      CheckInResult;
  note:        string | null;
  overrideBy:  string | null;
}

export interface RegistrationTokenProps {
  id:           string;
  tokenValue:   string;   // random 32-char hex prefix "tk_"
  type:         RegistrationTokenType;
  status:       RegistrationTokenStatus;
  referenceId:  string;   // bookingId / membershipId / workshopId etc.
  customerId:   string;
  validFrom:    Date;
  validUntil:   Date;
  lastScannedAt: Date | null;
  scanCount:    number;
  scanHistory:  CheckInEvent[];
  tenantId:     string;
  createdAt:    Date;
  updatedAt:    Date;
}

export class RegistrationToken {
  private readonly props: Readonly<RegistrationTokenProps>;

  constructor(props: RegistrationTokenProps) {
    if (!props.id.trim())          throw new Error('id is required');
    if (!props.tokenValue.trim())  throw new Error('tokenValue is required');
    if (!props.referenceId.trim()) throw new Error('referenceId is required');
    if (!props.customerId.trim())  throw new Error('customerId is required');
    if (!props.tenantId.trim())    throw new Error('tenantId is required');
    if (props.validUntil <= props.validFrom)
      throw new Error('validUntil must be after validFrom');

    this.props = { ...props, scanHistory: [...props.scanHistory] };
  }

  private clone(patch: Partial<RegistrationTokenProps>): RegistrationToken {
    return new RegistrationToken({
      ...this.props,
      ...patch,
      scanHistory: patch.scanHistory ?? [...this.props.scanHistory],
      updatedAt: new Date(),
    });
  }

  get id()            { return this.props.id; }
  get tokenValue()    { return this.props.tokenValue; }
  get type()          { return this.props.type; }
  get status()        { return this.props.status; }
  get referenceId()   { return this.props.referenceId; }
  get customerId()    { return this.props.customerId; }
  get validFrom()     { return this.props.validFrom; }
  get validUntil()    { return this.props.validUntil; }
  get lastScannedAt() { return this.props.lastScannedAt; }
  get scanCount()     { return this.props.scanCount; }
  get scanHistory()   { return [...this.props.scanHistory]; }
  get tenantId()      { return this.props.tenantId; }
  get createdAt()     { return this.props.createdAt; }
  get updatedAt()     { return this.props.updatedAt; }

  isExpired(now: Date): boolean {
    return now >= this.props.validUntil || this.props.status === 'expired';
  }

  isActive(now: Date): boolean {
    return (
      this.props.status === 'active' &&
      now >= this.props.validFrom &&
      now < this.props.validUntil
    );
  }

  isAlreadyScanned(): boolean {
    return this.props.scanCount > 0 && this.props.type === 'class_booking';
  }

  recordScan(event: CheckInEvent): RegistrationToken {
    if (this.props.status === 'revoked')   throw new Error('Cannot scan a revoked token');
    if (this.props.status === 'cancelled') throw new Error('Cannot scan a cancelled token');

    const history = [...this.props.scanHistory, event];
    return this.clone({
      scanCount:    this.props.scanCount + 1,
      lastScannedAt: event.scannedAt,
      scanHistory:  history,
      // Mark class_booking as 'used' after first valid scan
      status: (this.props.type === 'class_booking' && event.result === 'valid')
        ? 'used'
        : this.props.status,
    });
  }

  revoke(): RegistrationToken {
    if (this.props.status === 'used') throw new Error('Cannot revoke a used token');
    return this.clone({ status: 'revoked' });
  }

  cancel(): RegistrationToken {
    if (this.props.status === 'used') throw new Error('Cannot cancel a used token');
    return this.clone({ status: 'cancelled' });
  }

  expire(): RegistrationToken {
    return this.clone({ status: 'expired' });
  }

  checkinUrl(baseUrl: string): string {
    return `${baseUrl}/checkin/${this.props.tokenValue}`;
  }

  toJSON(): RegistrationTokenProps {
    return { ...this.props, scanHistory: [...this.props.scanHistory] };
  }
}
