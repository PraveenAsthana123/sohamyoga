export type ReferralCodeStatus = "active" | "paused" | "expired" | "revoked";

export type ReferralType =
  | "customer_customer"
  | "teacher_student"
  | "student_teacher"
  | "corporate"
  | "doctor"
  | "hospital"
  | "partner"
  | "influencer"
  | "affiliate"
  | "employee"
  | "franchise"
  | "event"
  | "workshop"
  | "retreat";

export type ReferralChannel =
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "x"
  | "telegram"
  | "qr_code"
  | "email"
  | "sms"
  | "direct_link"
  | "nfc";

export interface ReferralCodeProps {
  id: string;
  code: string;
  referrerId: string;
  referrerType: ReferralType;
  campaignId?: string;
  referralUrl: string;
  status: ReferralCodeStatus;
  maxUses?: number;
  usedCount: number;
  clickCount: number;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ReferralCode {
  private readonly props: Readonly<ReferralCodeProps>;

  constructor(props: ReferralCodeProps) {
    if (!props.id?.trim()) throw new Error("id is required");
    if (!props.code?.trim()) throw new Error("code is required");
    if (!props.referrerId?.trim()) throw new Error("referrerId is required");
    if (!props.referralUrl?.trim()) throw new Error("referralUrl is required");
    if (props.usedCount < 0) throw new Error("usedCount must be >= 0");
    if (props.clickCount < 0) throw new Error("clickCount must be >= 0");
    if (props.maxUses !== undefined && props.maxUses < 1) throw new Error("maxUses must be >= 1");
    if (props.maxUses !== undefined && props.usedCount > props.maxUses) {
      throw new Error("usedCount cannot exceed maxUses");
    }
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get code() { return this.props.code; }
  get referrerId() { return this.props.referrerId; }
  get referrerType() { return this.props.referrerType; }
  get campaignId() { return this.props.campaignId; }
  get referralUrl() { return this.props.referralUrl; }
  get status() { return this.props.status; }
  get maxUses() { return this.props.maxUses; }
  get usedCount() { return this.props.usedCount; }
  get clickCount() { return this.props.clickCount; }
  get expiresAt() { return this.props.expiresAt; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }

  isExpired(at: Date = new Date()): boolean {
    return this.props.expiresAt !== undefined && at >= this.props.expiresAt;
  }

  isMaxedOut(): boolean {
    return this.props.maxUses !== undefined && this.props.usedCount >= this.props.maxUses;
  }

  canBeUsed(at: Date = new Date()): boolean {
    return (
      this.props.status === "active" &&
      !this.isExpired(at) &&
      !this.isMaxedOut()
    );
  }

  recordClick(): ReferralCode {
    return new ReferralCode({
      ...this.props,
      clickCount: this.props.clickCount + 1,
      updatedAt: new Date(),
    });
  }

  recordUse(): ReferralCode {
    if (!this.canBeUsed()) {
      throw new Error("Referral code cannot be used: inactive, expired, or maxed out");
    }
    return new ReferralCode({
      ...this.props,
      usedCount: this.props.usedCount + 1,
      updatedAt: new Date(),
    });
  }

  pause(): ReferralCode {
    if (this.props.status !== "active") throw new Error("Only active codes can be paused");
    return new ReferralCode({ ...this.props, status: "paused", updatedAt: new Date() });
  }

  resume(): ReferralCode {
    if (this.props.status !== "paused") throw new Error("Only paused codes can be resumed");
    return new ReferralCode({ ...this.props, status: "active", updatedAt: new Date() });
  }

  revoke(): ReferralCode {
    if (this.props.status === "revoked") throw new Error("Code is already revoked");
    return new ReferralCode({ ...this.props, status: "revoked", updatedAt: new Date() });
  }

  expire(): ReferralCode {
    if (this.props.status === "revoked") throw new Error("Revoked code cannot be expired");
    if (this.props.status === "expired") throw new Error("Code is already expired");
    return new ReferralCode({ ...this.props, status: "expired", updatedAt: new Date() });
  }
}
