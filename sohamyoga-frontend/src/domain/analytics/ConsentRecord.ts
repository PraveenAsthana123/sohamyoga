export type ConsentLevel = "none" | "essential" | "analytics" | "marketing" | "all";

// Ordered from weakest to strongest — used for hierarchy comparisons
export const CONSENT_HIERARCHY: ConsentLevel[] = [
  "none", "essential", "analytics", "marketing", "all",
];

export interface ConsentRecordProps {
  id: string;
  anonymousId: string;
  userId?: string;
  level: ConsentLevel;
  granted: boolean;
  grantedAt?: Date;
  revokedAt?: Date;
  /** SHA-256 of visitor IP — never store raw IP */
  ipHash: string;
  userAgent: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ConsentRecord {
  constructor(private readonly props: ConsentRecordProps) {
    if (!props.id)          throw new Error("id is required");
    if (!props.anonymousId) throw new Error("anonymousId is required");
    if (!props.ipHash)      throw new Error("ipHash is required (SHA-256 of IP)");
    if (!props.userAgent)   throw new Error("userAgent is required");
    if (props.granted && !props.grantedAt)
      throw new Error("grantedAt required when granted is true");
    if (props.revokedAt && !props.grantedAt)
      throw new Error("cannot revoke without a prior grantedAt");
    if (props.revokedAt && props.grantedAt && props.revokedAt <= props.grantedAt)
      throw new Error("revokedAt must be after grantedAt");
  }

  get id()          { return this.props.id; }
  get anonymousId() { return this.props.anonymousId; }
  get userId()      { return this.props.userId; }
  get level()       { return this.props.level; }
  get granted()     { return this.props.granted; }
  get grantedAt()   { return this.props.grantedAt; }
  get revokedAt()   { return this.props.revokedAt; }
  get ipHash()      { return this.props.ipHash; }
  get userAgent()   { return this.props.userAgent; }
  get createdAt()   { return this.props.createdAt; }
  get updatedAt()   { return this.props.updatedAt; }

  isRevoked(): boolean {
    return !!this.props.revokedAt;
  }

  isGranted(required: ConsentLevel): boolean {
    if (!this.props.granted || this.isRevoked()) return false;
    const currentIdx  = CONSENT_HIERARCHY.indexOf(this.props.level);
    const requiredIdx = CONSENT_HIERARCHY.indexOf(required);
    return currentIdx >= requiredIdx;
  }

  canCollectAnalytics(): boolean { return this.isGranted("analytics"); }
  canCollectMarketing(): boolean { return this.isGranted("marketing"); }

  grant(level: ConsentLevel, at: Date): ConsentRecord {
    return new ConsentRecord({
      ...this.props,
      level,
      granted: true,
      grantedAt: at,
      revokedAt: undefined,
      updatedAt: at,
    });
  }

  revoke(at: Date): ConsentRecord {
    if (this.isRevoked())    throw new Error("consent is already revoked");
    if (!this.props.granted) throw new Error("cannot revoke a consent that was not granted");
    return new ConsentRecord({
      ...this.props,
      granted: false,
      revokedAt: at,
      updatedAt: at,
    });
  }

  upgrade(newLevel: ConsentLevel, at: Date): ConsentRecord {
    const currentIdx = CONSENT_HIERARCHY.indexOf(this.props.level);
    const newIdx     = CONSENT_HIERARCHY.indexOf(newLevel);
    if (newIdx <= currentIdx) throw new Error("upgrade requires a higher consent level than current");
    return this.grant(newLevel, at);
  }

  downgrade(newLevel: ConsentLevel, at: Date): ConsentRecord {
    const currentIdx = CONSENT_HIERARCHY.indexOf(this.props.level);
    const newIdx     = CONSENT_HIERARCHY.indexOf(newLevel);
    if (newIdx >= currentIdx) throw new Error("downgrade requires a lower consent level than current");
    return new ConsentRecord({ ...this.props, level: newLevel, updatedAt: at });
  }

  identify(userId: string, at: Date): ConsentRecord {
    if (!userId) throw new Error("userId is required");
    return new ConsentRecord({ ...this.props, userId, updatedAt: at });
  }
}
