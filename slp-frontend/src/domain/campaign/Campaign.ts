export type CampaignStatus = "DRAFT" | "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type CampaignChannel = "email" | "whatsapp" | "sms" | "push" | "in_app" | "social";
export type CampaignType =
  | "one_time"          // single blast
  | "drip"              // sequence over time
  | "trigger"           // event-based (signup, birthday, inactivity)
  | "ab_test"           // A/B variant test
  | "referral"          // referral program
  | "retargeting";      // re-engage churned users

export interface CampaignProps {
  id: string;
  name: string;
  description: string;
  type: CampaignType;
  channels: CampaignChannel[];
  status: CampaignStatus;
  audienceSegmentId: string;
  contentVariantIds: string[];     // 1 for standard, 2 for A/B
  couponId?: string;               // optional promo code attached
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  goalType: "class_bookings" | "membership_conversions" | "referrals" | "re_engagement" | "awareness";
  goalTarget: number;              // e.g. 50 bookings
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CampaignCreatedEvent {
  readonly type = "CampaignCreated" as const;
  constructor(public readonly campaignId: string, public readonly name: string) {}
}
export class CampaignLaunchedEvent {
  readonly type = "CampaignLaunched" as const;
  constructor(public readonly campaignId: string, public readonly channels: CampaignChannel[]) {}
}

export class Campaign {
  private _events: (CampaignCreatedEvent | CampaignLaunchedEvent)[] = [];

  constructor(private props: CampaignProps) {
    if (!props.name.trim()) throw new Error("Campaign name is required");
    if (props.channels.length === 0) throw new Error("At least one channel required");
    if (props.goalTarget < 1) throw new Error("Goal target must be >= 1");
    if (props.type === "ab_test" && props.contentVariantIds.length < 2)
      throw new Error("A/B test campaigns require at least 2 content variants");
  }

  get id()               { return this.props.id; }
  get name()             { return this.props.name; }
  get description()      { return this.props.description; }
  get type()             { return this.props.type; }
  get channels()         { return [...this.props.channels]; }
  get status()           { return this.props.status; }
  get audienceSegmentId(){ return this.props.audienceSegmentId; }
  get contentVariantIds(){ return [...this.props.contentVariantIds]; }
  get couponId()         { return this.props.couponId; }
  get scheduledAt()      { return this.props.scheduledAt; }
  get goalType()         { return this.props.goalType; }
  get goalTarget()       { return this.props.goalTarget; }
  get domainEvents()     { return [...this._events]; }

  isRunning(): boolean { return this.props.status === "RUNNING"; }
  isDraft(): boolean   { return this.props.status === "DRAFT"; }
  isABTest(): boolean  { return this.props.type === "ab_test"; }

  schedule(at: Date): Campaign {
    if (this.props.status !== "DRAFT") throw new Error("Only DRAFT campaigns can be scheduled");
    if (at <= new Date()) throw new Error("Scheduled time must be in the future");
    this.props = { ...this.props, status: "SCHEDULED", scheduledAt: at, updatedAt: new Date() };
    return this;
  }

  launch(): Campaign {
    if (!["DRAFT", "SCHEDULED"].includes(this.props.status))
      throw new Error("Only DRAFT or SCHEDULED campaigns can be launched");
    this.props = { ...this.props, status: "RUNNING", startedAt: new Date(), updatedAt: new Date() };
    this._events.push(new CampaignLaunchedEvent(this.props.id, this.props.channels));
    return this;
  }

  pause(): Campaign {
    if (this.props.status !== "RUNNING") throw new Error("Only RUNNING campaigns can be paused");
    this.props = { ...this.props, status: "PAUSED", updatedAt: new Date() };
    return this;
  }

  resume(): Campaign {
    if (this.props.status !== "PAUSED") throw new Error("Only PAUSED campaigns can be resumed");
    this.props = { ...this.props, status: "RUNNING", updatedAt: new Date() };
    return this;
  }

  complete(): Campaign {
    this.props = { ...this.props, status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() };
    return this;
  }

  cancel(): Campaign {
    if (this.props.status === "COMPLETED") throw new Error("Cannot cancel a completed campaign");
    this.props = { ...this.props, status: "CANCELLED", updatedAt: new Date() };
    return this;
  }

  static create(props: Omit<CampaignProps, "createdAt" | "updatedAt" | "status">): Campaign {
    const c = new Campaign({ ...props, status: "DRAFT", createdAt: new Date(), updatedAt: new Date() });
    c._events.push(new CampaignCreatedEvent(props.id, props.name));
    return c;
  }

  toJSON(): CampaignProps { return { ...this.props, channels: [...this.props.channels], contentVariantIds: [...this.props.contentVariantIds] }; }
}
