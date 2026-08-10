// Wave 15: Google Ads-like Platform — Campaign domain entity

export type CampaignStatus    = 'draft' | 'active' | 'paused' | 'archived' | 'ended';
export type CampaignType      = 'search' | 'display' | 'video' | 'shopping' | 'app';
export type BiddingStrategy   = 'manual_cpc' | 'target_cpa' | 'target_roas' | 'maximize_clicks' | 'maximize_conversions';
export type DeviceTarget      = 'desktop' | 'mobile' | 'tablet' | 'tv';

export interface CampaignProps {
  id:                string;
  name:              string;
  campaignType:      CampaignType;
  status:            CampaignStatus;
  dailyBudgetCents:  number;
  totalBudgetCents?: number;
  biddingStrategy:   BiddingStrategy;
  geoTargets:        string[];
  deviceTargets:     DeviceTarget[];
  languageTargets:   string[];
  audienceTargets:   string[];
  adGroupIds:        string[];
  tags:              string[];
  startDate:         Date;
  endDate?:          Date;
  createdAt:         Date;
  updatedAt:         Date;
}

export class AdCampaign {
  private readonly props: Readonly<CampaignProps>;

  constructor(props: CampaignProps) {
    if (!props.id?.trim())   throw new Error('id is required');
    if (!props.name?.trim()) throw new Error('name is required');
    if (props.dailyBudgetCents < 1)
      throw new Error('dailyBudgetCents must be at least 1');
    if (props.totalBudgetCents !== undefined && props.totalBudgetCents < props.dailyBudgetCents)
      throw new Error('totalBudgetCents must be >= dailyBudgetCents');
    if (props.endDate && props.endDate <= props.startDate)
      throw new Error('endDate must be after startDate');
    if (props.status === 'ended' && !props.endDate)
      throw new Error('ended campaign must have endDate');

    this.props = {
      ...props,
      geoTargets:      [...props.geoTargets],
      deviceTargets:   [...props.deviceTargets],
      languageTargets: [...props.languageTargets],
      audienceTargets: [...props.audienceTargets],
      adGroupIds:      [...props.adGroupIds],
      tags:            [...props.tags],
    };
  }

  get id()               { return this.props.id; }
  get name()             { return this.props.name; }
  get campaignType()     { return this.props.campaignType; }
  get status()           { return this.props.status; }
  get dailyBudgetCents() { return this.props.dailyBudgetCents; }
  get totalBudgetCents() { return this.props.totalBudgetCents; }
  get biddingStrategy()  { return this.props.biddingStrategy; }
  get geoTargets()       { return [...this.props.geoTargets]; }
  get deviceTargets()    { return [...this.props.deviceTargets]; }
  get languageTargets()  { return [...this.props.languageTargets]; }
  get audienceTargets()  { return [...this.props.audienceTargets]; }
  get adGroupIds()       { return [...this.props.adGroupIds]; }
  get tags()             { return [...this.props.tags]; }
  get startDate()        { return this.props.startDate; }
  get endDate()          { return this.props.endDate; }
  get createdAt()        { return this.props.createdAt; }
  get updatedAt()        { return this.props.updatedAt; }

  isActive()   { return this.props.status === 'active';   }
  isDraft()    { return this.props.status === 'draft';    }
  isPaused()   { return this.props.status === 'paused';   }
  isArchived() { return this.props.status === 'archived'; }
  isEnded()    { return this.props.status === 'ended';    }

  private clone(patch: Partial<CampaignProps>): AdCampaign {
    return new AdCampaign({ ...this.props, ...patch });
  }

  activate(now: Date): AdCampaign {
    if (this.props.status === 'active')   throw new Error('campaign is already active');
    if (this.props.status === 'archived') throw new Error('cannot activate an archived campaign');
    if (this.props.status === 'ended')    throw new Error('cannot activate an ended campaign');
    return this.clone({ status: 'active', updatedAt: now });
  }

  pause(now: Date): AdCampaign {
    if (this.props.status !== 'active') throw new Error('can only pause an active campaign');
    return this.clone({ status: 'paused', updatedAt: now });
  }

  archive(now: Date): AdCampaign {
    if (this.props.status === 'archived') throw new Error('campaign is already archived');
    return this.clone({ status: 'archived', updatedAt: now });
  }

  end(endDate: Date, now: Date): AdCampaign {
    if (this.props.status === 'ended')       throw new Error('campaign is already ended');
    if (endDate <= this.props.startDate)     throw new Error('endDate must be after startDate');
    return this.clone({ status: 'ended', endDate, updatedAt: now });
  }

  setDailyBudget(cents: number, now: Date): AdCampaign {
    if (cents < 1) throw new Error('dailyBudgetCents must be at least 1');
    if (this.props.totalBudgetCents !== undefined && cents > this.props.totalBudgetCents)
      throw new Error('dailyBudgetCents cannot exceed totalBudgetCents');
    return this.clone({ dailyBudgetCents: cents, updatedAt: now });
  }

  setTotalBudget(cents: number, now: Date): AdCampaign {
    if (cents < this.props.dailyBudgetCents)
      throw new Error('totalBudgetCents must be >= dailyBudgetCents');
    return this.clone({ totalBudgetCents: cents, updatedAt: now });
  }

  setBiddingStrategy(strategy: BiddingStrategy, now: Date): AdCampaign {
    return this.clone({ biddingStrategy: strategy, updatedAt: now });
  }

  addGeoTarget(geo: string, now: Date): AdCampaign {
    if (!geo?.trim()) throw new Error('geo target cannot be empty');
    if (this.props.geoTargets.includes(geo)) throw new Error(`geo "${geo}" already exists`);
    return this.clone({ geoTargets: [...this.props.geoTargets, geo], updatedAt: now });
  }

  removeGeoTarget(geo: string, now: Date): AdCampaign {
    if (!this.props.geoTargets.includes(geo)) throw new Error(`geo "${geo}" not found`);
    return this.clone({ geoTargets: this.props.geoTargets.filter(g => g !== geo), updatedAt: now });
  }

  addAdGroup(adGroupId: string, now: Date): AdCampaign {
    if (!adGroupId?.trim()) throw new Error('adGroupId cannot be empty');
    if (this.props.adGroupIds.includes(adGroupId)) throw new Error('adGroup already added');
    return this.clone({ adGroupIds: [...this.props.adGroupIds, adGroupId], updatedAt: now });
  }

  removeAdGroup(adGroupId: string, now: Date): AdCampaign {
    if (!this.props.adGroupIds.includes(adGroupId)) throw new Error('adGroup not found');
    return this.clone({ adGroupIds: this.props.adGroupIds.filter(id => id !== adGroupId), updatedAt: now });
  }

  addTag(tag: string, now: Date): AdCampaign {
    if (!tag?.trim()) throw new Error('tag cannot be empty');
    if (this.props.tags.includes(tag)) throw new Error(`tag "${tag}" already exists`);
    return this.clone({ tags: [...this.props.tags, tag], updatedAt: now });
  }

  removeTag(tag: string, now: Date): AdCampaign {
    if (!this.props.tags.includes(tag)) throw new Error(`tag "${tag}" not found`);
    return this.clone({ tags: this.props.tags.filter(t => t !== tag), updatedAt: now });
  }
}
