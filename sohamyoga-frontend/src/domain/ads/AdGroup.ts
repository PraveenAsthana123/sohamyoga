// Wave 15: Google Ads-like Platform — Ad Group domain entity

export type AdGroupStatus   = 'active' | 'paused' | 'removed';
export type KeywordMatchType = 'broad' | 'phrase' | 'exact';

export interface Keyword {
  text:                string;
  matchType:           KeywordMatchType;
  bidAdjustmentPercent?: number; // -90 to +900
}

export interface AdGroupProps {
  id:               string;
  campaignId:       string;
  name:             string;
  status:           AdGroupStatus;
  defaultBidCents:  number;       // CPC in cents; >= 1
  keywords:         Keyword[];
  adIds:            string[];
  createdAt:        Date;
  updatedAt:        Date;
}

export class AdGroup {
  private readonly props: Readonly<AdGroupProps>;

  constructor(props: AdGroupProps) {
    if (!props.id?.trim())         throw new Error('id is required');
    if (!props.campaignId?.trim()) throw new Error('campaignId is required');
    if (!props.name?.trim())       throw new Error('name is required');
    if (props.defaultBidCents < 1) throw new Error('defaultBidCents must be at least 1');

    for (const kw of props.keywords) {
      if (!kw.text?.trim()) throw new Error('keyword text cannot be empty');
      if (kw.bidAdjustmentPercent !== undefined &&
          (kw.bidAdjustmentPercent < -90 || kw.bidAdjustmentPercent > 900))
        throw new Error('keyword bidAdjustmentPercent must be -90 to 900');
    }

    this.props = {
      ...props,
      keywords: props.keywords.map(k => ({ ...k })),
      adIds:    [...props.adIds],
    };
  }

  get id()              { return this.props.id; }
  get campaignId()      { return this.props.campaignId; }
  get name()            { return this.props.name; }
  get status()          { return this.props.status; }
  get defaultBidCents() { return this.props.defaultBidCents; }
  get keywords()        { return this.props.keywords.map(k => ({ ...k })); }
  get adIds()           { return [...this.props.adIds]; }
  get createdAt()       { return this.props.createdAt; }
  get updatedAt()       { return this.props.updatedAt; }

  isActive()  { return this.props.status === 'active';  }
  isPaused()  { return this.props.status === 'paused';  }
  isRemoved() { return this.props.status === 'removed'; }

  private clone(patch: Partial<AdGroupProps>): AdGroup {
    return new AdGroup({ ...this.props, ...patch });
  }

  activate(now: Date): AdGroup {
    if (this.props.status === 'active')  throw new Error('ad group is already active');
    if (this.props.status === 'removed') throw new Error('cannot activate a removed ad group');
    return this.clone({ status: 'active', updatedAt: now });
  }

  pause(now: Date): AdGroup {
    if (this.props.status !== 'active') throw new Error('can only pause an active ad group');
    return this.clone({ status: 'paused', updatedAt: now });
  }

  remove(now: Date): AdGroup {
    if (this.props.status === 'removed') throw new Error('ad group is already removed');
    return this.clone({ status: 'removed', updatedAt: now });
  }

  setDefaultBid(cents: number, now: Date): AdGroup {
    if (cents < 1) throw new Error('defaultBidCents must be at least 1');
    return this.clone({ defaultBidCents: cents, updatedAt: now });
  }

  addKeyword(keyword: Keyword, now: Date): AdGroup {
    if (!keyword.text?.trim()) throw new Error('keyword text cannot be empty');
    const exists = this.props.keywords.some(
      k => k.text === keyword.text && k.matchType === keyword.matchType
    );
    if (exists) throw new Error(`keyword "${keyword.text}" [${keyword.matchType}] already exists`);
    if (keyword.bidAdjustmentPercent !== undefined &&
        (keyword.bidAdjustmentPercent < -90 || keyword.bidAdjustmentPercent > 900))
      throw new Error('keyword bidAdjustmentPercent must be -90 to 900');
    return this.clone({ keywords: [...this.props.keywords, { ...keyword }], updatedAt: now });
  }

  removeKeyword(text: string, matchType: KeywordMatchType, now: Date): AdGroup {
    const idx = this.props.keywords.findIndex(k => k.text === text && k.matchType === matchType);
    if (idx === -1) throw new Error(`keyword "${text}" [${matchType}] not found`);
    const updated = this.props.keywords.filter((_, i) => i !== idx);
    return this.clone({ keywords: updated, updatedAt: now });
  }

  addAd(adId: string, now: Date): AdGroup {
    if (!adId?.trim()) throw new Error('adId cannot be empty');
    if (this.props.adIds.includes(adId)) throw new Error('ad already added');
    return this.clone({ adIds: [...this.props.adIds, adId], updatedAt: now });
  }

  removeAd(adId: string, now: Date): AdGroup {
    if (!this.props.adIds.includes(adId)) throw new Error('ad not found');
    return this.clone({ adIds: this.props.adIds.filter(id => id !== adId), updatedAt: now });
  }
}
