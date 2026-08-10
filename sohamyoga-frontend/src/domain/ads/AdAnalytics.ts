// Wave 15: Google Ads-like Platform — Analytics / Metrics domain entity

export interface AnalyticsPeriod {
  start: Date;
  end:   Date;
}

export interface AdAnalyticsProps {
  id:            string;
  campaignId:    string;
  adGroupId?:    string;
  adId?:         string;
  period:        AnalyticsPeriod;
  clicks:        number;
  impressions:   number;
  conversions:   number;
  spendCents:    number;   // total cost in cents
  revenueCents:  number;   // tracked revenue in cents
}

export class AdAnalytics {
  private readonly props: Readonly<AdAnalyticsProps>;

  constructor(props: AdAnalyticsProps) {
    if (!props.id?.trim())         throw new Error('id is required');
    if (!props.campaignId?.trim()) throw new Error('campaignId is required');
    if (props.period.end <= props.period.start)
      throw new Error('period end must be after start');
    if (props.clicks < 0)        throw new Error('clicks cannot be negative');
    if (props.impressions < 0)   throw new Error('impressions cannot be negative');
    if (props.conversions < 0)   throw new Error('conversions cannot be negative');
    if (props.spendCents < 0)    throw new Error('spendCents cannot be negative');
    if (props.revenueCents < 0)  throw new Error('revenueCents cannot be negative');
    if (props.clicks > props.impressions && props.impressions > 0)
      throw new Error('clicks cannot exceed impressions');

    this.props = { ...props, period: { ...props.period } };
  }

  get id()           { return this.props.id; }
  get campaignId()   { return this.props.campaignId; }
  get adGroupId()    { return this.props.adGroupId; }
  get adId()         { return this.props.adId; }
  get period()       { return { ...this.props.period }; }
  get clicks()       { return this.props.clicks; }
  get impressions()  { return this.props.impressions; }
  get conversions()  { return this.props.conversions; }
  get spendCents()   { return this.props.spendCents; }
  get revenueCents() { return this.props.revenueCents; }

  // Computed metrics — all return 0 on division by zero
  get ctr():  number { return this.props.impressions > 0 ? this.props.clicks / this.props.impressions : 0; }
  get cpc():  number { return this.props.clicks > 0 ? this.props.spendCents / this.props.clicks : 0; }
  get cpm():  number { return this.props.impressions > 0 ? (this.props.spendCents / this.props.impressions) * 1000 : 0; }
  get cpa():  number { return this.props.conversions > 0 ? this.props.spendCents / this.props.conversions : 0; }
  get roas(): number { return this.props.spendCents > 0 ? this.props.revenueCents / this.props.spendCents : 0; }
  get conversionRate(): number { return this.props.clicks > 0 ? this.props.conversions / this.props.clicks : 0; }

  private clone(patch: Partial<AdAnalyticsProps>): AdAnalytics {
    return new AdAnalytics({ ...this.props, ...patch });
  }

  addClicks(n: number): AdAnalytics {
    if (n < 0) throw new Error('n must be non-negative');
    return this.clone({ clicks: this.props.clicks + n });
  }

  addImpressions(n: number): AdAnalytics {
    if (n < 0) throw new Error('n must be non-negative');
    return this.clone({ impressions: this.props.impressions + n });
  }

  addConversion(spendCents: number, revenueCents: number): AdAnalytics {
    if (spendCents < 0)   throw new Error('spendCents cannot be negative');
    if (revenueCents < 0) throw new Error('revenueCents cannot be negative');
    return this.clone({
      conversions:  this.props.conversions + 1,
      spendCents:   this.props.spendCents + spendCents,
      revenueCents: this.props.revenueCents + revenueCents,
    });
  }

  addSpend(cents: number): AdAnalytics {
    if (cents < 0) throw new Error('cents cannot be negative');
    return this.clone({ spendCents: this.props.spendCents + cents });
  }

  merge(other: AdAnalytics): AdAnalytics {
    if (other.campaignId !== this.props.campaignId)
      throw new Error('cannot merge analytics from different campaigns');
    return this.clone({
      clicks:       this.props.clicks       + other.clicks,
      impressions:  this.props.impressions  + other.impressions,
      conversions:  this.props.conversions  + other.conversions,
      spendCents:   this.props.spendCents   + other.spendCents,
      revenueCents: this.props.revenueCents + other.revenueCents,
    });
  }
}
