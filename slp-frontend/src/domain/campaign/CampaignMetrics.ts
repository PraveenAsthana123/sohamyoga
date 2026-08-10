// Campaign analytics: delivery, engagement, conversion, ROI

export interface ChannelMetrics {
  channel: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  unsubscribed: number;
  bounced: number;
}

export interface CampaignMetricsProps {
  campaignId: string;
  audienceSize: number;
  channelMetrics: ChannelMetrics[];
  conversions: number;          // bookings / signups / purchases attributed
  revenueCAD: number;           // revenue directly attributed
  costCAD: number;              // campaign cost (ad spend, platform fees)
  goalTarget: number;
  computedAt: Date;
}

export class CampaignMetrics {
  constructor(private readonly props: CampaignMetricsProps) {}

  get campaignId()   { return this.props.campaignId; }
  get audienceSize() { return this.props.audienceSize; }
  get conversions()  { return this.props.conversions; }
  get revenueCAD()   { return this.props.revenueCAD; }
  get costCAD()      { return this.props.costCAD; }

  totalSent(): number      { return this.props.channelMetrics.reduce((s, c) => s + c.sent, 0); }
  totalDelivered(): number { return this.props.channelMetrics.reduce((s, c) => s + c.delivered, 0); }
  totalOpened(): number    { return this.props.channelMetrics.reduce((s, c) => s + c.opened, 0); }
  totalClicked(): number   { return this.props.channelMetrics.reduce((s, c) => s + c.clicked, 0); }

  deliveryRate(): number  { const s = this.totalSent(); return s > 0 ? this.totalDelivered() / s : 0; }
  openRate(): number      { const d = this.totalDelivered(); return d > 0 ? this.totalOpened() / d : 0; }
  clickRate(): number     { const o = this.totalOpened(); return o > 0 ? this.totalClicked() / o : 0; }
  conversionRate(): number{ const s = this.totalSent(); return s > 0 ? this.props.conversions / s : 0; }

  roi(): number {
    if (this.props.costCAD === 0) return this.props.revenueCAD > 0 ? Infinity : 0;
    return (this.props.revenueCAD - this.props.costCAD) / this.props.costCAD;
  }

  roiPercent(): number { return this.roi() === Infinity ? Infinity : this.roi() * 100; }

  goalProgressPercent(): number {
    return Math.min(100, Math.round((this.props.conversions / this.props.goalTarget) * 100));
  }

  isGoalMet(): boolean { return this.props.conversions >= this.props.goalTarget; }

  metricsForChannel(channel: string): ChannelMetrics | undefined {
    return this.props.channelMetrics.find(c => c.channel === channel);
  }

  toJSON(): CampaignMetricsProps {
    return { ...this.props, channelMetrics: this.props.channelMetrics.map(c => ({ ...c })) };
  }
}

export interface LeadScoreProps {
  userId: string;
  score: number;              // 0–100
  signals: {
    factor: string;
    weight: number;
    value: number;
  }[];
  tier: "cold" | "warm" | "hot" | "customer";
  computedAt: Date;
}

export class LeadScore {
  constructor(private readonly props: LeadScoreProps) {
    if (props.score < 0 || props.score > 100) throw new Error("Score must be 0–100");
  }

  get userId()  { return this.props.userId; }
  get score()   { return this.props.score; }
  get tier()    { return this.props.tier; }
  get signals() { return this.props.signals.map(s => ({ ...s })); }

  static computeTier(score: number): LeadScoreProps["tier"] {
    if (score >= 75) return "hot";
    if (score >= 50) return "warm";
    if (score >= 25) return "cold";
    return "cold";
  }

  isReadyToConvert(): boolean { return this.props.tier === "hot"; }

  toJSON(): LeadScoreProps { return { ...this.props, signals: this.props.signals.map(s => ({ ...s })) }; }
}
