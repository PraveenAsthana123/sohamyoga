import type { ReferralType } from "./ReferralCode";
import type { RewardType } from "./ReferralReward";

export type CampaignStatus = "draft" | "active" | "paused" | "ended";
export type CampaignType = "standard" | "double_reward" | "flash" | "corporate" | "seasonal";

export interface ReferralCampaignProps {
  id: string;
  name: string;
  slug: string;
  type: CampaignType;
  status: CampaignStatus;
  rewardType: RewardType;
  referrerRewardValue: number;
  referreeRewardValue: number;
  maxReferrals?: number;
  maxRewardPerReferrer?: number;
  eligibleReferralTypes: ReferralType[];
  requiresMembershipPurchase: boolean;
  startDate: Date;
  endDate?: Date;
  totalReferrals: number;
  totalRewardsPaid: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ReferralCampaign {
  private readonly props: Readonly<ReferralCampaignProps>;

  constructor(props: ReferralCampaignProps) {
    if (!props.id?.trim()) throw new Error("id is required");
    if (!props.name?.trim()) throw new Error("name is required");
    if (!props.slug?.trim()) throw new Error("slug is required");
    if (!/^[a-z0-9-]+$/.test(props.slug)) throw new Error("slug must be lowercase kebab-case");
    if (props.referrerRewardValue < 0) throw new Error("referrerRewardValue must be >= 0");
    if (props.referreeRewardValue < 0) throw new Error("referreeRewardValue must be >= 0");
    if (props.referrerRewardValue === 0 && props.referreeRewardValue === 0) {
      throw new Error("At least one reward value must be > 0");
    }
    if (props.maxReferrals !== undefined && props.maxReferrals < 1) {
      throw new Error("maxReferrals must be >= 1");
    }
    if (props.maxRewardPerReferrer !== undefined && props.maxRewardPerReferrer < 1) {
      throw new Error("maxRewardPerReferrer must be >= 1");
    }
    if (props.eligibleReferralTypes.length === 0) {
      throw new Error("At least one eligible referral type required");
    }
    if (props.totalReferrals < 0) throw new Error("totalReferrals must be >= 0");
    if (props.totalRewardsPaid < 0) throw new Error("totalRewardsPaid must be >= 0");
    if (props.endDate && props.endDate <= props.startDate) {
      throw new Error("endDate must be after startDate");
    }
    this.props = {
      ...props,
      eligibleReferralTypes: [...props.eligibleReferralTypes],
    };
  }

  get id() { return this.props.id; }
  get name() { return this.props.name; }
  get slug() { return this.props.slug; }
  get type() { return this.props.type; }
  get status() { return this.props.status; }
  get rewardType() { return this.props.rewardType; }
  get referrerRewardValue() { return this.props.referrerRewardValue; }
  get referreeRewardValue() { return this.props.referreeRewardValue; }
  get maxReferrals() { return this.props.maxReferrals; }
  get maxRewardPerReferrer() { return this.props.maxRewardPerReferrer; }
  get eligibleReferralTypes() { return [...this.props.eligibleReferralTypes]; }
  get requiresMembershipPurchase() { return this.props.requiresMembershipPurchase; }
  get startDate() { return this.props.startDate; }
  get endDate() { return this.props.endDate; }
  get totalReferrals() { return this.props.totalReferrals; }
  get totalRewardsPaid() { return this.props.totalRewardsPaid; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }

  isActive(at: Date = new Date()): boolean {
    if (this.props.status !== "active") return false;
    if (at < this.props.startDate) return false;
    if (this.props.endDate && at >= this.props.endDate) return false;
    if (
      this.props.maxReferrals !== undefined &&
      this.props.totalReferrals >= this.props.maxReferrals
    ) {
      return false;
    }
    return true;
  }

  isEligibleType(type: ReferralType): boolean {
    return this.props.eligibleReferralTypes.includes(type);
  }

  activate(): ReferralCampaign {
    if (this.props.status === "ended") throw new Error("Ended campaigns cannot be activated");
    if (this.props.status === "active") throw new Error("Campaign is already active");
    return new ReferralCampaign({
      ...this.props,
      eligibleReferralTypes: [...this.props.eligibleReferralTypes],
      status: "active",
      updatedAt: new Date(),
    });
  }

  pause(): ReferralCampaign {
    if (this.props.status !== "active") throw new Error("Only active campaigns can be paused");
    return new ReferralCampaign({
      ...this.props,
      eligibleReferralTypes: [...this.props.eligibleReferralTypes],
      status: "paused",
      updatedAt: new Date(),
    });
  }

  end(): ReferralCampaign {
    if (this.props.status === "ended") throw new Error("Campaign is already ended");
    return new ReferralCampaign({
      ...this.props,
      eligibleReferralTypes: [...this.props.eligibleReferralTypes],
      status: "ended",
      updatedAt: new Date(),
    });
  }

  recordReferral(rewardAmount: number): ReferralCampaign {
    if (!this.isActive()) throw new Error("Campaign is not active");
    if (rewardAmount < 0) throw new Error("rewardAmount must be >= 0");
    return new ReferralCampaign({
      ...this.props,
      eligibleReferralTypes: [...this.props.eligibleReferralTypes],
      totalReferrals: this.props.totalReferrals + 1,
      totalRewardsPaid:
        Math.round((this.props.totalRewardsPaid + rewardAmount) * 100) / 100,
      updatedAt: new Date(),
    });
  }

  addEligibleType(type: ReferralType): ReferralCampaign {
    if (this.props.eligibleReferralTypes.includes(type)) return this;
    return new ReferralCampaign({
      ...this.props,
      eligibleReferralTypes: [...this.props.eligibleReferralTypes, type],
      updatedAt: new Date(),
    });
  }

  removeEligibleType(type: ReferralType): ReferralCampaign {
    const filtered = this.props.eligibleReferralTypes.filter(t => t !== type);
    if (filtered.length === 0) {
      throw new Error("Cannot remove last eligible referral type");
    }
    return new ReferralCampaign({
      ...this.props,
      eligibleReferralTypes: filtered,
      updatedAt: new Date(),
    });
  }
}
