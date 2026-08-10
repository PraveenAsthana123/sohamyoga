// Wave 15: Google Ads-like Platform — Advertisement domain entity

export type AdType   = 'responsive_search' | 'display' | 'banner' | 'video' | 'image' | 'dynamic' | 'call';
export type AdStatus = 'active' | 'paused' | 'removed' | 'under_review';

export interface AdProps {
  id:               string;
  adGroupId:        string;
  name:             string;
  adType:           AdType;
  status:           AdStatus;
  headlines:        string[];    // 1-15 for RSA; min 1
  descriptions:     string[];    // 1-4 for RSA; min 1
  imageUrls:        string[];
  videoUrl?:        string;
  callToAction?:    string;
  finalUrl:         string;
  aiGenerated:      boolean;
  generatedBy?:     string;      // 'ollama', 'comfyui'
  impressionCount:  number;
  clickCount:       number;
  conversionCount:  number;
  spendCents:       number;
  createdAt:        Date;
  updatedAt:        Date;
}

export class Advertisement {
  private readonly props: Readonly<AdProps>;

  constructor(props: AdProps) {
    if (!props.id?.trim())       throw new Error('id is required');
    if (!props.adGroupId?.trim()) throw new Error('adGroupId is required');
    if (!props.name?.trim())     throw new Error('name is required');
    if (!props.finalUrl?.trim()) throw new Error('finalUrl is required');
    if (props.headlines.length < 1)    throw new Error('at least 1 headline is required');
    if (props.headlines.length > 15)   throw new Error('maximum 15 headlines allowed');
    if (props.descriptions.length < 1) throw new Error('at least 1 description is required');
    if (props.descriptions.length > 4) throw new Error('maximum 4 descriptions allowed');
    if (props.impressionCount < 0)     throw new Error('impressionCount cannot be negative');
    if (props.clickCount < 0)          throw new Error('clickCount cannot be negative');
    if (props.conversionCount < 0)     throw new Error('conversionCount cannot be negative');
    if (props.spendCents < 0)          throw new Error('spendCents cannot be negative');
    if (props.clickCount > props.impressionCount)
      throw new Error('clickCount cannot exceed impressionCount');

    this.props = {
      ...props,
      headlines:    [...props.headlines],
      descriptions: [...props.descriptions],
      imageUrls:    [...props.imageUrls],
    };
  }

  get id()              { return this.props.id; }
  get adGroupId()       { return this.props.adGroupId; }
  get name()            { return this.props.name; }
  get adType()          { return this.props.adType; }
  get status()          { return this.props.status; }
  get headlines()       { return [...this.props.headlines]; }
  get descriptions()    { return [...this.props.descriptions]; }
  get imageUrls()       { return [...this.props.imageUrls]; }
  get videoUrl()        { return this.props.videoUrl; }
  get callToAction()    { return this.props.callToAction; }
  get finalUrl()        { return this.props.finalUrl; }
  get aiGenerated()     { return this.props.aiGenerated; }
  get generatedBy()     { return this.props.generatedBy; }
  get impressionCount() { return this.props.impressionCount; }
  get clickCount()      { return this.props.clickCount; }
  get conversionCount() { return this.props.conversionCount; }
  get spendCents()      { return this.props.spendCents; }
  get createdAt()       { return this.props.createdAt; }
  get updatedAt()       { return this.props.updatedAt; }

  isActive()      { return this.props.status === 'active';       }
  isPaused()      { return this.props.status === 'paused';       }
  isRemoved()     { return this.props.status === 'removed';      }
  isUnderReview() { return this.props.status === 'under_review'; }

  ctr(): number {
    return this.props.impressionCount > 0
      ? this.props.clickCount / this.props.impressionCount
      : 0;
  }

  cpc(): number {
    return this.props.clickCount > 0
      ? this.props.spendCents / this.props.clickCount
      : 0;
  }

  conversionRate(): number {
    return this.props.clickCount > 0
      ? this.props.conversionCount / this.props.clickCount
      : 0;
  }

  private clone(patch: Partial<AdProps>): Advertisement {
    return new Advertisement({ ...this.props, ...patch });
  }

  activate(now: Date): Advertisement {
    if (this.props.status === 'active')  throw new Error('ad is already active');
    if (this.props.status === 'removed') throw new Error('cannot activate a removed ad');
    return this.clone({ status: 'active', updatedAt: now });
  }

  pause(now: Date): Advertisement {
    if (this.props.status !== 'active') throw new Error('can only pause an active ad');
    return this.clone({ status: 'paused', updatedAt: now });
  }

  remove(now: Date): Advertisement {
    if (this.props.status === 'removed') throw new Error('ad is already removed');
    return this.clone({ status: 'removed', updatedAt: now });
  }

  submitForReview(now: Date): Advertisement {
    if (this.props.status === 'under_review') throw new Error('ad is already under review');
    if (this.props.status === 'removed')      throw new Error('cannot submit a removed ad for review');
    return this.clone({ status: 'under_review', updatedAt: now });
  }

  updateHeadlines(headlines: string[], now: Date): Advertisement {
    if (headlines.length < 1)  throw new Error('at least 1 headline is required');
    if (headlines.length > 15) throw new Error('maximum 15 headlines allowed');
    return this.clone({ headlines: [...headlines], updatedAt: now });
  }

  updateDescriptions(descriptions: string[], now: Date): Advertisement {
    if (descriptions.length < 1) throw new Error('at least 1 description is required');
    if (descriptions.length > 4) throw new Error('maximum 4 descriptions allowed');
    return this.clone({ descriptions: [...descriptions], updatedAt: now });
  }

  recordImpression(now: Date): Advertisement {
    return this.clone({ impressionCount: this.props.impressionCount + 1, updatedAt: now });
  }

  recordClick(now: Date): Advertisement {
    return this.clone({
      clickCount:      this.props.clickCount + 1,
      impressionCount: Math.max(this.props.impressionCount, this.props.clickCount + 1),
      updatedAt:       now,
    });
  }

  recordConversion(spendCents: number, now: Date): Advertisement {
    if (spendCents < 0) throw new Error('spendCents cannot be negative');
    return this.clone({
      conversionCount: this.props.conversionCount + 1,
      spendCents:      this.props.spendCents + spendCents,
      updatedAt:       now,
    });
  }
}
