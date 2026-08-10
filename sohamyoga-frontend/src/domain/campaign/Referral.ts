export type ReferralStatus = "PENDING" | "SIGNED_UP" | "CONVERTED" | "REWARDED" | "EXPIRED";

export interface ReferralProps {
  id: string;
  referrerId: string;          // user who sent the referral
  refereeEmail: string;        // who was invited
  refereeId?: string;          // set once they sign up
  referralCode: string;        // unique code in the link
  status: ReferralStatus;
  referrerReward: string;      // "1 free class" or "$10 credit"
  refereeReward: string;       // "7-day free trial extended to 14 days"
  campaignId?: string;
  createdAt: Date;
  expiresAt: Date;
  convertedAt?: Date;
  rewardedAt?: Date;
}

export class ReferralConvertedEvent {
  readonly type = "ReferralConverted" as const;
  constructor(public readonly referralId: string, public readonly referrerId: string, public readonly refereeId: string) {}
}

export class Referral {
  private _events: ReferralConvertedEvent[] = [];

  constructor(private props: ReferralProps) {
    if (!props.refereeEmail.includes("@")) throw new Error("Invalid referee email");
    if (!props.referralCode.trim()) throw new Error("Referral code is required");
    if (props.expiresAt <= props.createdAt) throw new Error("Expiry must be after creation");
  }

  get id()             { return this.props.id; }
  get referrerId()     { return this.props.referrerId; }
  get refereeEmail()   { return this.props.refereeEmail; }
  get referralCode()   { return this.props.referralCode; }
  get status()         { return this.props.status; }
  get referrerReward() { return this.props.referrerReward; }
  get refereeReward()  { return this.props.refereeReward; }
  get domainEvents()   { return [...this._events]; }

  isExpired(): boolean { return new Date() > this.props.expiresAt; }
  isActive(): boolean  { return this.props.status === "PENDING" && !this.isExpired(); }

  linkUsed(refereeId: string): Referral {
    if (!this.isActive()) throw new Error("Referral link is no longer active");
    if (refereeId === this.props.referrerId) throw new Error("Cannot refer yourself");
    this.props = { ...this.props, status: "SIGNED_UP", refereeId };
    return this;
  }

  convert(): Referral {
    if (this.props.status !== "SIGNED_UP") throw new Error("Referee must have signed up first");
    this.props = { ...this.props, status: "CONVERTED", convertedAt: new Date() };
    this._events.push(new ReferralConvertedEvent(this.props.id, this.props.referrerId, this.props.refereeId!));
    return this;
  }

  reward(): Referral {
    if (this.props.status !== "CONVERTED") throw new Error("Referral must be converted before rewarding");
    this.props = { ...this.props, status: "REWARDED", rewardedAt: new Date() };
    return this;
  }

  expire(): Referral {
    if (this.props.status !== "PENDING") return this;
    return new Referral({ ...this.props, status: "EXPIRED" });
  }

  shareLink(baseUrl: string): string {
    return `${baseUrl}/join?ref=${this.props.referralCode}`;
  }

  toJSON(): ReferralProps { return { ...this.props }; }
}
