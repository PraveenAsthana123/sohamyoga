// ContentVariant — platform-specific adaptation of a master campaign message.
// One CampaignBrief produces one ContentVariant per target platform.
// PLATFORM_LIMITS enforces character counts, hashtag limits, and tone guidance.
// AI adaptation (adapt_for_platform MCP) uses local Ollama — no cloud AI.

export type ContentPlatform =
  | 'facebook' | 'instagram' | 'linkedin' | 'x_twitter' | 'threads' | 'tiktok'
  | 'youtube' | 'pinterest' | 'reddit' | 'bluesky' | 'mastodon'
  | 'telegram' | 'discord' | 'whatsapp_business'
  | 'email' | 'sms' | 'push' | 'banner' | 'blog';

export type ContentVariantStatus = 'draft' | 'approved' | 'published';

export interface PlatformConfig {
  maxChars:     number;       // -1 = unlimited
  maxHashtags:  number;
  toneHint:     string;
  supportsMedia:boolean;
  mediaRatios:  string[];     // e.g. ['1:1', '16:9', '9:16']
}

export const PLATFORM_LIMITS: Record<ContentPlatform, PlatformConfig> = {
  facebook:          { maxChars: 63206, maxHashtags: 5,  toneHint: 'conversational',       supportsMedia: true,  mediaRatios: ['1:1','16:9','4:5'] },
  instagram:         { maxChars: 2200,  maxHashtags: 30, toneHint: 'visual-caption',        supportsMedia: true,  mediaRatios: ['1:1','4:5','9:16'] },
  linkedin:          { maxChars: 3000,  maxHashtags: 5,  toneHint: 'professional-insight',  supportsMedia: true,  mediaRatios: ['1.91:1','1:1'] },
  x_twitter:         { maxChars: 280,   maxHashtags: 2,  toneHint: 'concise-punchy',        supportsMedia: true,  mediaRatios: ['16:9','1:1'] },
  threads:           { maxChars: 500,   maxHashtags: 5,  toneHint: 'conversational',        supportsMedia: true,  mediaRatios: ['1:1','4:5'] },
  tiktok:            { maxChars: 2200,  maxHashtags: 10, toneHint: 'trending-hook',         supportsMedia: true,  mediaRatios: ['9:16'] },
  youtube:           { maxChars: 5000,  maxHashtags: 15, toneHint: 'descriptive-chapters',  supportsMedia: true,  mediaRatios: ['16:9'] },
  pinterest:         { maxChars: 500,   maxHashtags: 20, toneHint: 'search-optimized',      supportsMedia: true,  mediaRatios: ['2:3','1:1'] },
  reddit:            { maxChars: 40000, maxHashtags: 0,  toneHint: 'community-authentic',   supportsMedia: true,  mediaRatios: ['16:9','1:1'] },
  bluesky:           { maxChars: 300,   maxHashtags: 2,  toneHint: 'concise-authentic',     supportsMedia: true,  mediaRatios: ['16:9','1:1'] },
  mastodon:          { maxChars: 500,   maxHashtags: 5,  toneHint: 'conversational',        supportsMedia: true,  mediaRatios: ['16:9','1:1'] },
  telegram:          { maxChars: 4096,  maxHashtags: 5,  toneHint: 'announcement-buttons',  supportsMedia: true,  mediaRatios: ['1:1','16:9'] },
  discord:           { maxChars: 2000,  maxHashtags: 0,  toneHint: 'community-casual',      supportsMedia: true,  mediaRatios: ['16:9'] },
  whatsapp_business: { maxChars: 1024,  maxHashtags: 0,  toneHint: 'direct-personal',       supportsMedia: true,  mediaRatios: ['1:1','16:9','9:16'] },
  email:             { maxChars: -1,    maxHashtags: 0,  toneHint: 'formal-structured',     supportsMedia: true,  mediaRatios: ['600px-wide'] },
  sms:               { maxChars: 160,   maxHashtags: 0,  toneHint: 'ultra-concise-direct',  supportsMedia: false, mediaRatios: [] },
  push:              { maxChars: 100,   maxHashtags: 0,  toneHint: 'alert-action',          supportsMedia: false, mediaRatios: [] },
  banner:            { maxChars: 120,   maxHashtags: 0,  toneHint: 'headline-cta',          supportsMedia: true,  mediaRatios: ['16:9','1:1','3:1'] },
  blog:              { maxChars: -1,    maxHashtags: 10, toneHint: 'long-form-educational', supportsMedia: true,  mediaRatios: ['16:9','3:2'] },
};

export interface ContentVariantProps {
  id:                string;
  tenantId:          string;
  briefId?:          string;
  platform:          ContentPlatform;
  masterContent:     string;         // original brief text before adaptation
  adaptedContent:    string;
  adaptedSubject?:   string;         // for email channel
  hashtags:          string[];
  mediaAspectRatio?: string;
  isAiGenerated:     boolean;
  status:            ContentVariantStatus;
  approvedBy?:       string;
  approvedAt?:       Date;
  publishedAt?:      Date;
  createdAt:         Date;
  updatedAt:         Date;
}

export class ContentVariant {
  private readonly props: Readonly<ContentVariantProps>;

  constructor(props: ContentVariantProps) {
    if (!props.id)              throw new Error('id is required');
    if (!props.masterContent.trim()) throw new Error('masterContent is required');
    if (!props.adaptedContent.trim()) throw new Error('adaptedContent is required');
    const limit = PLATFORM_LIMITS[props.platform];
    if (limit.maxChars !== -1 && props.adaptedContent.length > limit.maxChars)
      throw new Error(`adaptedContent exceeds ${limit.maxChars} char limit for ${props.platform}`);
    if (props.hashtags.length > limit.maxHashtags && limit.maxHashtags > 0)
      throw new Error(`too many hashtags: ${props.hashtags.length} > ${limit.maxHashtags} for ${props.platform}`);
    if (props.platform === 'email' && props.status === 'approved' && !props.adaptedSubject?.trim())
      throw new Error('adaptedSubject required for email variants');
    if (props.status === 'approved' && !props.approvedBy)
      throw new Error('approvedBy required when status is approved');
    this.props = Object.freeze({ ...props, hashtags: [...props.hashtags] });
  }

  private clone(patch: Partial<ContentVariantProps>): ContentVariant {
    return new ContentVariant({ ...this.props, ...patch });
  }

  get id()               { return this.props.id; }
  get platform()         { return this.props.platform; }
  get masterContent()    { return this.props.masterContent; }
  get adaptedContent()   { return this.props.adaptedContent; }
  get adaptedSubject()   { return this.props.adaptedSubject; }
  get hashtags()         { return [...this.props.hashtags]; }
  get isAiGenerated()    { return this.props.isAiGenerated; }
  get status()           { return this.props.status; }
  get approvedBy()       { return this.props.approvedBy; }
  get publishedAt()      { return this.props.publishedAt; }
  get updatedAt()        { return this.props.updatedAt; }

  get characterCount():  number { return this.props.adaptedContent.length; }
  get platformConfig():  PlatformConfig { return PLATFORM_LIMITS[this.props.platform]; }

  isDraft():     boolean { return this.props.status === 'draft'; }
  isApproved():  boolean { return this.props.status === 'approved'; }
  isPublished(): boolean { return this.props.status === 'published'; }

  isWithinCharLimit(): boolean {
    const limit = PLATFORM_LIMITS[this.props.platform].maxChars;
    return limit === -1 || this.props.adaptedContent.length <= limit;
  }

  /** Maker-checker: draft → approved */
  approve(approvedBy: string, at: Date): ContentVariant {
    if (this.props.status !== 'draft')
      throw new Error(`Can only approve draft variants, current status: ${this.props.status}`);
    if (this.props.platform === 'email' && !this.props.adaptedSubject?.trim())
      throw new Error('adaptedSubject required before approving email variant');
    return this.clone({ status: 'approved', approvedBy, approvedAt: at, updatedAt: at });
  }

  /** Publish (post sent to platform) — approved → published */
  markPublished(at: Date): ContentVariant {
    if (this.props.status !== 'approved')
      throw new Error(`Can only publish approved variants, current status: ${this.props.status}`);
    return this.clone({ status: 'published', publishedAt: at, updatedAt: at });
  }

  /** Edit content — always resets to draft */
  updateContent(adaptedContent: string, subject: string | undefined, at: Date): ContentVariant {
    if (!adaptedContent.trim()) throw new Error('adaptedContent cannot be empty');
    const limit = PLATFORM_LIMITS[this.props.platform];
    if (limit.maxChars !== -1 && adaptedContent.length > limit.maxChars)
      throw new Error(`adaptedContent exceeds ${limit.maxChars} char limit for ${this.props.platform}`);
    if (this.props.status === 'published')
      throw new Error('Cannot edit a published content variant');
    return this.clone({
      adaptedContent,
      adaptedSubject: subject,
      status:     'draft',
      approvedBy: undefined,
      approvedAt: undefined,
      updatedAt:  at,
    });
  }
}
