// Social media campaign — groups related drafts, tracks cross-platform metrics

export type CampaignGoal =
  | "brand_awareness" | "engagement" | "follower_growth"
  | "website_traffic" | "lead_generation" | "event_promotion" | "product_launch";

export type SocialCampaignStatus = "draft" | "active" | "paused" | "completed" | "cancelled";

export interface SocialCampaignMetrics {
  totalImpressions: number;
  totalReach: number;
  totalClicks: number;
  totalEngagements: number;
  totalConversions: number;
  avgEngagementRate: number;
  followerDelta: number;
  postsPublished: number;
  postsFailed: number;
  postsPending: number;
}

export interface SocialCampaignProps {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  goal: CampaignGoal;
  status: SocialCampaignStatus;
  platforms: string[];         // SocialPlatform[]
  draftIds: string[];
  startsAt: Date;
  endsAt: Date;
  budget?: number;
  metrics: SocialCampaignMetrics;
  pauseReason?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SocialCampaign {
  constructor(private props: SocialCampaignProps) {
    if (!props.name.trim()) throw new Error("Campaign name required");
    if (props.endsAt <= props.startsAt) throw new Error("End date must be after start date");
    if (props.platforms.length === 0) throw new Error("At least one platform required");
  }

  get id()          { return this.props.id; }
  get name()        { return this.props.name; }
  get status()      { return this.props.status; }
  get goal()        { return this.props.goal; }
  get platforms()   { return [...this.props.platforms]; }
  get draftIds()    { return [...this.props.draftIds]; }
  get metrics()     { return { ...this.props.metrics }; }
  get pauseReason() { return this.props.pauseReason; }

  isLive(): boolean { return this.props.status === "active" && this.props.startsAt <= new Date() && this.props.endsAt >= new Date(); }
  daysRemaining(): number { return Math.max(0, Math.ceil((this.props.endsAt.getTime() - Date.now()) / 86400000)); }

  activate(): SocialCampaign {
    if (this.props.status !== "draft") throw new Error("Only draft campaigns can be activated");
    return new SocialCampaign({ ...this.props, status: "active", updatedAt: new Date() });
  }

  pause(reason: string): SocialCampaign {
    if (this.props.status !== "active") throw new Error("Only active campaigns can be paused");
    if (!reason.trim()) throw new Error("Pause reason required for audit log");
    return new SocialCampaign({ ...this.props, status: "paused", pauseReason: reason, updatedAt: new Date() });
  }

  resume(): SocialCampaign {
    if (this.props.status !== "paused") throw new Error("Only paused campaigns can be resumed");
    return new SocialCampaign({ ...this.props, status: "active", pauseReason: undefined, updatedAt: new Date() });
  }

  complete(): SocialCampaign {
    if (!["active", "paused"].includes(this.props.status)) throw new Error("Cannot complete campaign in current state");
    return new SocialCampaign({ ...this.props, status: "completed", updatedAt: new Date() });
  }

  addDraft(draftId: string): SocialCampaign {
    if (this.props.draftIds.includes(draftId)) return this;
    return new SocialCampaign({ ...this.props, draftIds: [...this.props.draftIds, draftId], updatedAt: new Date() });
  }

  updateMetrics(patch: Partial<SocialCampaignMetrics>): SocialCampaign {
    return new SocialCampaign({ ...this.props, metrics: { ...this.props.metrics, ...patch }, updatedAt: new Date() });
  }

  engagementRate(): number {
    if (this.props.metrics.totalReach === 0) return 0;
    return Math.round((this.props.metrics.totalEngagements / this.props.metrics.totalReach) * 10000) / 100;
  }

  toJSON(): SocialCampaignProps {
    return { ...this.props, platforms: [...this.props.platforms], draftIds: [...this.props.draftIds] };
  }
}
