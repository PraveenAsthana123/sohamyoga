import type { ReferralType, ReferralChannel } from "./ReferralCode";

export type ReferralStatus =
  | "draft"
  | "shared"
  | "clicked"
  | "registered"
  | "verified"
  | "membership_purchased"
  | "reward_pending"
  | "reward_approved"
  | "reward_rejected"
  | "reward_paid"
  | "expired";

export interface ReferralProps {
  id: string;
  referralCodeId: string;
  referrerId: string;
  referreeEmail: string;
  referreeId?: string;
  type: ReferralType;
  status: ReferralStatus;
  channel?: ReferralChannel;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  clickedAt?: Date;
  registeredAt?: Date;
  verifiedAt?: Date;
  purchasedAt?: Date;
  rewardPaidAt?: Date;
  rejectionReason?: string;
  fraudFlags: string[];
  orderAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const TERMINAL_STATUSES: ReferralStatus[] = ["reward_paid", "reward_rejected", "expired"];

export class Referral {
  private readonly props: Readonly<ReferralProps>;

  constructor(props: ReferralProps) {
    if (!props.id?.trim()) throw new Error("id is required");
    if (!props.referralCodeId?.trim()) throw new Error("referralCodeId is required");
    if (!props.referrerId?.trim()) throw new Error("referrerId is required");
    if (!props.referreeEmail?.trim()) throw new Error("referreeEmail is required");
    if (props.orderAmount !== undefined && props.orderAmount < 0) {
      throw new Error("orderAmount must be >= 0");
    }
    this.props = { ...props, fraudFlags: [...props.fraudFlags] };
  }

  get id() { return this.props.id; }
  get referralCodeId() { return this.props.referralCodeId; }
  get referrerId() { return this.props.referrerId; }
  get referreeEmail() { return this.props.referreeEmail; }
  get referreeId() { return this.props.referreeId; }
  get type() { return this.props.type; }
  get status() { return this.props.status; }
  get channel() { return this.props.channel; }
  get utmSource() { return this.props.utmSource; }
  get utmMedium() { return this.props.utmMedium; }
  get utmCampaign() { return this.props.utmCampaign; }
  get clickedAt() { return this.props.clickedAt; }
  get registeredAt() { return this.props.registeredAt; }
  get verifiedAt() { return this.props.verifiedAt; }
  get purchasedAt() { return this.props.purchasedAt; }
  get rewardPaidAt() { return this.props.rewardPaidAt; }
  get rejectionReason() { return this.props.rejectionReason; }
  get fraudFlags() { return [...this.props.fraudFlags]; }
  get orderAmount() { return this.props.orderAmount; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }

  hasFraudFlags(): boolean {
    return this.props.fraudFlags.length > 0;
  }

  isTerminal(): boolean {
    return TERMINAL_STATUSES.includes(this.props.status);
  }

  share(channel: ReferralChannel): Referral {
    if (this.props.status !== "draft") throw new Error("Only draft referrals can be shared");
    return new Referral({
      ...this.props,
      fraudFlags: [...this.props.fraudFlags],
      status: "shared",
      channel,
      updatedAt: new Date(),
    });
  }

  click(at: Date = new Date()): Referral {
    if (this.props.status !== "shared" && this.props.status !== "draft") {
      throw new Error("Referral must be shared or draft to record a click");
    }
    return new Referral({
      ...this.props,
      fraudFlags: [...this.props.fraudFlags],
      status: "clicked",
      clickedAt: at,
      updatedAt: new Date(),
    });
  }

  register(referreeId: string, at: Date = new Date()): Referral {
    if (!referreeId?.trim()) throw new Error("referreeId is required");
    const allowed: ReferralStatus[] = ["clicked", "shared", "draft"];
    if (!allowed.includes(this.props.status)) {
      throw new Error("Referral must be clicked, shared, or draft to register");
    }
    return new Referral({
      ...this.props,
      fraudFlags: [...this.props.fraudFlags],
      status: "registered",
      referreeId,
      registeredAt: at,
      updatedAt: new Date(),
    });
  }

  verify(at: Date = new Date()): Referral {
    if (this.props.status !== "registered") throw new Error("Referral must be registered to verify");
    return new Referral({
      ...this.props,
      fraudFlags: [...this.props.fraudFlags],
      status: "verified",
      verifiedAt: at,
      updatedAt: new Date(),
    });
  }

  recordPurchase(orderAmount: number, at: Date = new Date()): Referral {
    const allowed: ReferralStatus[] = ["verified", "registered"];
    if (!allowed.includes(this.props.status)) {
      throw new Error("Referral must be verified or registered to record purchase");
    }
    if (orderAmount <= 0) throw new Error("orderAmount must be > 0");
    return new Referral({
      ...this.props,
      fraudFlags: [...this.props.fraudFlags],
      status: "membership_purchased",
      orderAmount,
      purchasedAt: at,
      updatedAt: new Date(),
    });
  }

  pendingReward(): Referral {
    const allowed: ReferralStatus[] = ["membership_purchased", "verified"];
    if (!allowed.includes(this.props.status)) {
      throw new Error("Referral must have a purchase or be verified to pend reward");
    }
    return new Referral({
      ...this.props,
      fraudFlags: [...this.props.fraudFlags],
      status: "reward_pending",
      updatedAt: new Date(),
    });
  }

  approveReward(): Referral {
    if (this.props.status !== "reward_pending") {
      throw new Error("Referral must be reward_pending to approve");
    }
    return new Referral({
      ...this.props,
      fraudFlags: [...this.props.fraudFlags],
      status: "reward_approved",
      updatedAt: new Date(),
    });
  }

  rejectReward(reason: string): Referral {
    if (!reason?.trim()) throw new Error("Rejection reason is required");
    if (this.props.status !== "reward_pending") {
      throw new Error("Referral must be reward_pending to reject");
    }
    return new Referral({
      ...this.props,
      fraudFlags: [...this.props.fraudFlags],
      status: "reward_rejected",
      rejectionReason: reason,
      updatedAt: new Date(),
    });
  }

  markRewardPaid(at: Date = new Date()): Referral {
    if (this.props.status !== "reward_approved") {
      throw new Error("Referral must be reward_approved to mark paid");
    }
    return new Referral({
      ...this.props,
      fraudFlags: [...this.props.fraudFlags],
      status: "reward_paid",
      rewardPaidAt: at,
      updatedAt: new Date(),
    });
  }

  expire(): Referral {
    if (TERMINAL_STATUSES.includes(this.props.status)) {
      throw new Error(`Cannot expire referral with status: ${this.props.status}`);
    }
    return new Referral({
      ...this.props,
      fraudFlags: [...this.props.fraudFlags],
      status: "expired",
      updatedAt: new Date(),
    });
  }

  addFraudFlag(flag: string): Referral {
    if (!flag?.trim()) throw new Error("Fraud flag must not be empty");
    return new Referral({
      ...this.props,
      fraudFlags: [...this.props.fraudFlags, flag],
      updatedAt: new Date(),
    });
  }

  clearFraudFlags(): Referral {
    return new Referral({
      ...this.props,
      fraudFlags: [],
      updatedAt: new Date(),
    });
  }
}
