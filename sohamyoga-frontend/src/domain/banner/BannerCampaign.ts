// Banner campaign — groups banners for a promotional period; supports A/B testing
// Backed by Strapi CMS; analytics from PostHog + Metabase

export type CampaignStatus = "draft" | "approved" | "active" | "paused" | "completed" | "archived";
export type CampaignType =
  | "seasonal" | "festival" | "weekend" | "holiday" | "flash"
  | "ab_test" | "ongoing" | "launch" | "referral";

export interface AbTestVariant {
  id: string;
  name: string;          // "Variant A"
  bannerId: string;
  trafficPercent: number; // must sum to 100 across variants
  viewCount: number;
  clickCount: number;
}

export interface CampaignPersonalization {
  countries?: string[];
  languages?: string[];
  membershipTiers?: string[];
  deviceTypes?: string[];
  isNewCustomer?: boolean;
}

export interface BannerCampaignProps {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  bannerIds: string[];
  abTestVariants?: AbTestVariant[];
  startAt: Date;
  endAt: Date;
  timezone: string;
  targetAudience?: CampaignPersonalization;
  budget?: number;
  currency?: string;
  approvedBy?: string;
  approvedAt?: Date;
  pauseReason?: string;
  notes: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BannerCampaign {
  constructor(private props: BannerCampaignProps) {
    if (!props.name.trim()) throw new Error("Campaign name required");
    if (props.endAt <= props.startAt) throw new Error("Campaign end must be after start");
    if (props.bannerIds.length === 0) throw new Error("Campaign must include at least one banner");
    if (props.budget !== undefined && props.budget < 0) throw new Error("Budget cannot be negative");
    if (props.abTestVariants) {
      const total = props.abTestVariants.reduce((s, v) => s + v.trafficPercent, 0);
      if (total !== 100) throw new Error(`A/B test traffic must sum to 100, got ${total}`);
    }
  }

  get id()          { return this.props.id; }
  get name()        { return this.props.name; }
  get type()        { return this.props.type; }
  get status()      { return this.props.status; }
  get bannerIds()   { return [...this.props.bannerIds]; }
  get startAt()     { return this.props.startAt; }
  get endAt()       { return this.props.endAt; }
  get timezone()    { return this.props.timezone; }
  get budget()      { return this.props.budget; }
  get currency()    { return this.props.currency; }
  get approvedBy()  { return this.props.approvedBy; }
  get pauseReason() { return this.props.pauseReason; }

  isActive(): boolean { return this.props.status === "active"; }

  isExpired(): boolean {
    return this.props.status !== "archived" && this.props.endAt < new Date();
  }

  durationDays(): number {
    return Math.ceil((this.props.endAt.getTime() - this.props.startAt.getTime()) / 86400000);
  }

  isAbTest(): boolean { return !!this.props.abTestVariants && this.props.abTestVariants.length >= 2; }

  winningVariant(): AbTestVariant | null {
    if (!this.props.abTestVariants || this.props.abTestVariants.length === 0) return null;
    return this.props.abTestVariants.reduce((best, v) => {
      const bestCtr = best.viewCount > 0 ? best.clickCount / best.viewCount : 0;
      const vCtr    = v.viewCount    > 0 ? v.clickCount    / v.viewCount    : 0;
      return vCtr > bestCtr ? v : best;
    });
  }

  approve(approvedBy: string): BannerCampaign {
    if (!approvedBy.trim()) throw new Error("Approver ID required");
    if (this.props.status !== "draft") throw new Error("Only draft campaigns can be approved");
    return new BannerCampaign({ ...this.props, status: "approved", approvedBy, approvedAt: new Date(), updatedAt: new Date() });
  }

  activate(): BannerCampaign {
    if (!["approved", "paused"].includes(this.props.status)) throw new Error("Can only activate approved or paused campaigns");
    return new BannerCampaign({ ...this.props, status: "active", updatedAt: new Date() });
  }

  pause(reason: string): BannerCampaign {
    if (!reason.trim()) throw new Error("Pause reason required");
    if (this.props.status !== "active") throw new Error("Only active campaigns can be paused");
    return new BannerCampaign({ ...this.props, status: "paused", pauseReason: reason, updatedAt: new Date() });
  }

  complete(): BannerCampaign {
    if (!["active", "paused"].includes(this.props.status)) throw new Error("Can only complete active or paused campaigns");
    return new BannerCampaign({ ...this.props, status: "completed", updatedAt: new Date() });
  }

  archive(): BannerCampaign {
    if (this.props.status === "archived") throw new Error("Already archived");
    return new BannerCampaign({ ...this.props, status: "archived", updatedAt: new Date() });
  }

  addBanner(bannerId: string): BannerCampaign {
    if (this.props.bannerIds.includes(bannerId)) return this;
    return new BannerCampaign({ ...this.props, bannerIds: [...this.props.bannerIds, bannerId], updatedAt: new Date() });
  }

  removeBanner(bannerId: string): BannerCampaign {
    if (this.props.bannerIds.length <= 1) throw new Error("Campaign must keep at least one banner");
    return new BannerCampaign({ ...this.props, bannerIds: this.props.bannerIds.filter(id => id !== bannerId), updatedAt: new Date() });
  }

  toJSON(): BannerCampaignProps {
    return { ...this.props, bannerIds: [...this.props.bannerIds] };
  }
}
