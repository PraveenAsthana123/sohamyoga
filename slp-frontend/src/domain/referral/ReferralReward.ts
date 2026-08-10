export type RewardType =
  | "cash"
  | "wallet_credit"
  | "reward_points"
  | "membership_extension"
  | "free_class"
  | "discount_coupon"
  | "gift_card"
  | "merchandise"
  | "yoga_mat"
  | "meditation_course"
  | "vip_membership"
  | "workshop_access";

export type RewardStatus = "pending" | "approved" | "rejected" | "paid" | "expired";

export interface ReferralRewardProps {
  id: string;
  referralId: string;
  referrerId: string;
  referreeId: string;
  type: RewardType;
  value: number;
  currency?: string;
  status: RewardStatus;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  paidAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ReferralReward {
  private readonly props: Readonly<ReferralRewardProps>;

  constructor(props: ReferralRewardProps) {
    if (!props.id?.trim()) throw new Error("id is required");
    if (!props.referralId?.trim()) throw new Error("referralId is required");
    if (!props.referrerId?.trim()) throw new Error("referrerId is required");
    if (!props.referreeId?.trim()) throw new Error("referreeId is required");
    if (props.value <= 0) throw new Error("value must be > 0");
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get referralId() { return this.props.referralId; }
  get referrerId() { return this.props.referrerId; }
  get referreeId() { return this.props.referreeId; }
  get type() { return this.props.type; }
  get value() { return this.props.value; }
  get currency() { return this.props.currency; }
  get status() { return this.props.status; }
  get approvedBy() { return this.props.approvedBy; }
  get rejectedBy() { return this.props.rejectedBy; }
  get rejectionReason() { return this.props.rejectionReason; }
  get paidAt() { return this.props.paidAt; }
  get expiresAt() { return this.props.expiresAt; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }

  isExpired(at: Date = new Date()): boolean {
    return this.props.expiresAt !== undefined && at >= this.props.expiresAt;
  }

  isCashEquivalent(): boolean {
    return ["cash", "wallet_credit", "gift_card"].includes(this.props.type);
  }

  isServiceReward(): boolean {
    return [
      "free_class",
      "workshop_access",
      "vip_membership",
      "meditation_course",
    ].includes(this.props.type);
  }

  isPhysicalReward(): boolean {
    return ["merchandise", "yoga_mat"].includes(this.props.type);
  }

  approve(approvedBy: string): ReferralReward {
    if (!approvedBy?.trim()) throw new Error("approvedBy is required");
    if (this.props.status !== "pending") throw new Error("Only pending rewards can be approved");
    return new ReferralReward({
      ...this.props,
      status: "approved",
      approvedBy,
      updatedAt: new Date(),
    });
  }

  reject(rejectedBy: string, reason: string): ReferralReward {
    if (!rejectedBy?.trim()) throw new Error("rejectedBy is required");
    if (!reason?.trim()) throw new Error("rejection reason is required");
    if (this.props.status !== "pending") throw new Error("Only pending rewards can be rejected");
    return new ReferralReward({
      ...this.props,
      status: "rejected",
      rejectedBy,
      rejectionReason: reason,
      updatedAt: new Date(),
    });
  }

  markPaid(at: Date = new Date()): ReferralReward {
    if (this.props.status !== "approved") throw new Error("Only approved rewards can be marked as paid");
    return new ReferralReward({
      ...this.props,
      status: "paid",
      paidAt: at,
      updatedAt: new Date(),
    });
  }

  markExpired(): ReferralReward {
    if (this.props.status === "paid") throw new Error("Paid rewards cannot be expired");
    if (this.props.status === "expired") throw new Error("Reward is already expired");
    return new ReferralReward({
      ...this.props,
      status: "expired",
      updatedAt: new Date(),
    });
  }
}
