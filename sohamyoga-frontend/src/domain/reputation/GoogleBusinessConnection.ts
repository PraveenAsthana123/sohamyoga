export type GoogleBusinessAuthStatus =
  | 'not_configured' | 'auth_requested' | 'active' | 'token_expired' | 'auth_revoked' | 'refresh_failed';

export interface GoogleBusinessConnectionProps {
  id: string;
  businessAccountId?: string;
  businessLocationId?: string;
  locationDisplayName?: string;
  authStatus: GoogleBusinessAuthStatus;
  grantedScopes: string[];
  tokenExpiresAt?: Date;
  lastSyncedAt?: Date;
  lastFailureAt?: Date;
  lastFailureMessage?: string;
}

export class GoogleBusinessConnection {
  private readonly props: GoogleBusinessConnectionProps;

  constructor(props: GoogleBusinessConnectionProps) {
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get authStatus() { return this.props.authStatus; }
  get isConnected() { return this.props.authStatus === 'active'; }
  get locationDisplayName() { return this.props.locationDisplayName; }

  markActive(scopes: string[], expiresAt?: Date): GoogleBusinessConnection {
    return new GoogleBusinessConnection({ ...this.props, authStatus: 'active', grantedScopes: scopes, tokenExpiresAt: expiresAt });
  }

  recordSyncFailure(message: string): GoogleBusinessConnection {
    return new GoogleBusinessConnection({ ...this.props, lastFailureAt: new Date(), lastFailureMessage: message });
  }

  recordSyncSuccess(): GoogleBusinessConnection {
    return new GoogleBusinessConnection({ ...this.props, lastSyncedAt: new Date() });
  }

  toJSON(): GoogleBusinessConnectionProps {
    return { ...this.props };
  }
}
