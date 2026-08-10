// Banner analytics — daily/weekly aggregation from PostHog + Metabase
// One record per banner per date; UI queries a range and sums

export type AnalyticsPeriod = "daily" | "weekly" | "monthly";

export interface DeviceBreakdown {
  desktop: number;
  tablet: number;
  mobile: number;
}

export interface CountryStats {
  code: string;     // ISO 3166-1 alpha-2
  name: string;
  views: number;
  clicks: number;
}

export interface BannerAnalyticsProps {
  id: string;
  bannerId: string;
  bannerTitle: string;
  campaignId?: string;
  campaignName?: string;
  period: AnalyticsPeriod;
  date: Date;
  views: number;
  clicks: number;
  conversions: number;      // registered/booked from CTA
  revenue: number;          // ERPNext: bookings attributed to banner
  currency: string;
  deviceBreakdown: DeviceBreakdown;
  topCountries: CountryStats[];
  createdAt: Date;
}

export class BannerAnalytics {
  constructor(private props: BannerAnalyticsProps) {
    if (!props.bannerId.trim()) throw new Error("Banner ID required");
    if (props.views < 0) throw new Error("Views cannot be negative");
    if (props.clicks < 0) throw new Error("Clicks cannot be negative");
    if (props.clicks > props.views) throw new Error("Clicks cannot exceed views");
    if (props.conversions < 0) throw new Error("Conversions cannot be negative");
    if (props.conversions > props.clicks) throw new Error("Conversions cannot exceed clicks");
    if (props.revenue < 0) throw new Error("Revenue cannot be negative");
  }

  get id()            { return this.props.id; }
  get bannerId()      { return this.props.bannerId; }
  get bannerTitle()   { return this.props.bannerTitle; }
  get campaignId()    { return this.props.campaignId; }
  get period()        { return this.props.period; }
  get date()          { return this.props.date; }
  get views()         { return this.props.views; }
  get clicks()        { return this.props.clicks; }
  get conversions()   { return this.props.conversions; }
  get revenue()       { return this.props.revenue; }
  get currency()      { return this.props.currency; }
  get deviceBreakdown() { return { ...this.props.deviceBreakdown }; }
  get topCountries()  { return this.props.topCountries.map(c => ({ ...c })); }

  ctr(): number {
    if (this.props.views === 0) return 0;
    return Math.round((this.props.clicks / this.props.views) * 10000) / 100;
  }

  conversionRate(): number {
    if (this.props.clicks === 0) return 0;
    return Math.round((this.props.conversions / this.props.clicks) * 10000) / 100;
  }

  revenuePerClick(): number {
    if (this.props.clicks === 0) return 0;
    return Math.round((this.props.revenue / this.props.clicks) * 100) / 100;
  }

  revenuePerView(): number {
    if (this.props.views === 0) return 0;
    return Math.round((this.props.revenue / this.props.views) * 100) / 100;
  }

  topDevice(): "desktop" | "tablet" | "mobile" {
    const d = this.props.deviceBreakdown;
    if (d.desktop >= d.tablet && d.desktop >= d.mobile) return "desktop";
    if (d.mobile >= d.desktop && d.mobile >= d.tablet) return "mobile";
    return "tablet";
  }

  totalDeviceViews(): number {
    const d = this.props.deviceBreakdown;
    return d.desktop + d.tablet + d.mobile;
  }

  devicePercent(device: keyof DeviceBreakdown): number {
    const total = this.totalDeviceViews();
    if (total === 0) return 0;
    return Math.round((this.props.deviceBreakdown[device] / total) * 100);
  }

  isHighPerforming(ctrThreshold = 2.0): boolean {
    return this.ctr() >= ctrThreshold && this.props.views >= 100;
  }

  // Static helper: aggregate multiple daily records
  static aggregate(records: BannerAnalytics[]): Omit<BannerAnalyticsProps, "id" | "date" | "period"> & { count: number } {
    const first = records[0];
    if (!first) throw new Error("Cannot aggregate empty records");
    return {
      bannerId:      first.props.bannerId,
      bannerTitle:   first.props.bannerTitle,
      campaignId:    first.props.campaignId,
      campaignName:  first.props.campaignName,
      views:         records.reduce((s, r) => s + r.props.views, 0),
      clicks:        records.reduce((s, r) => s + r.props.clicks, 0),
      conversions:   records.reduce((s, r) => s + r.props.conversions, 0),
      revenue:       records.reduce((s, r) => s + r.props.revenue, 0),
      currency:      first.props.currency,
      deviceBreakdown: {
        desktop: records.reduce((s, r) => s + r.props.deviceBreakdown.desktop, 0),
        tablet:  records.reduce((s, r) => s + r.props.deviceBreakdown.tablet, 0),
        mobile:  records.reduce((s, r) => s + r.props.deviceBreakdown.mobile, 0),
      },
      topCountries: [],
      createdAt: new Date(),
      count: records.length,
    };
  }

  toJSON(): BannerAnalyticsProps {
    return { ...this.props, topCountries: this.props.topCountries.map(c => ({ ...c })), deviceBreakdown: { ...this.props.deviceBreakdown } };
  }
}
