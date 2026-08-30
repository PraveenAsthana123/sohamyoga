// BrandKit — studio brand guidelines stored locally.
// Ensures consistent tone, colors, hashtags, and phrasing across all campaigns.
// One studio can have multiple brand kits (main brand, sub-brand, seasonal).

export type ToneWord =
  | 'warm' | 'professional' | 'inspiring' | 'inclusive' | 'playful'
  | 'authoritative' | 'mindful' | 'energetic' | 'calm' | 'premium';

export interface BrandKitProps {
  id:               string;
  tenantId:         string;
  name:             string;
  primaryColor:     string;     // hex e.g. '#4F46E5'
  secondaryColor:   string;
  accentColor:      string;
  logoUrl:          string;
  darkLogoUrl?:     string;
  fontPrimary:      string;     // e.g. 'Inter', 'Lato'
  fontSecondary?:   string;
  toneWords:        ToneWord[];
  approvedPhrases:  string[];   // e.g. 'Find your flow', 'Begin your journey'
  bannedPhrases:    string[];   // e.g. 'cheap', 'beginner-friendly' (if not allowed)
  defaultHashtags:  string[];   // e.g. '#SohamYoga', '#YogaLife', '#Mindfulness'
  isDefault:        boolean;
  updatedBy:        string;
  updatedAt:        Date;
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export class BrandKit {
  private readonly props: Readonly<BrandKitProps>;

  constructor(props: BrandKitProps) {
    if (!props.id)         throw new Error('id is required');
    if (!props.tenantId)   throw new Error('tenantId is required');
    if (!props.name.trim()) throw new Error('name is required');
    if (!HEX_RE.test(props.primaryColor))   throw new Error('primaryColor must be a valid hex color (#RRGGBB)');
    if (!HEX_RE.test(props.secondaryColor)) throw new Error('secondaryColor must be a valid hex color (#RRGGBB)');
    if (!HEX_RE.test(props.accentColor))    throw new Error('accentColor must be a valid hex color (#RRGGBB)');
    if (!props.fontPrimary.trim()) throw new Error('fontPrimary is required');
    if (props.toneWords.length === 0) throw new Error('at least one tone word is required');
    if (props.toneWords.length > 5)  throw new Error('maximum 5 tone words per brand kit');
    this.props = Object.freeze({
      ...props,
      toneWords:       [...props.toneWords],
      approvedPhrases: [...props.approvedPhrases],
      bannedPhrases:   [...props.bannedPhrases],
      defaultHashtags: [...props.defaultHashtags],
    });
  }

  private clone(patch: Partial<BrandKitProps>): BrandKit {
    return new BrandKit({ ...this.props, ...patch });
  }

  get id()               { return this.props.id; }
  get tenantId()         { return this.props.tenantId; }
  get name()             { return this.props.name; }
  get primaryColor()     { return this.props.primaryColor; }
  get secondaryColor()   { return this.props.secondaryColor; }
  get accentColor()      { return this.props.accentColor; }
  get logoUrl()          { return this.props.logoUrl; }
  get fontPrimary()      { return this.props.fontPrimary; }
  get toneWords()        { return [...this.props.toneWords]; }
  get approvedPhrases()  { return [...this.props.approvedPhrases]; }
  get bannedPhrases()    { return [...this.props.bannedPhrases]; }
  get defaultHashtags()  { return [...this.props.defaultHashtags]; }
  get isDefault()        { return this.props.isDefault; }
  get updatedAt()        { return this.props.updatedAt; }

  containsBannedPhrase(text: string): boolean {
    return this.props.bannedPhrases.some(p => text.toLowerCase().includes(p.toLowerCase()));
  }

  addApprovedPhrase(phrase: string, updatedBy: string, at: Date): BrandKit {
    if (!phrase.trim()) throw new Error('phrase cannot be empty');
    if (this.props.approvedPhrases.includes(phrase)) return this;
    return this.clone({ approvedPhrases: [...this.props.approvedPhrases, phrase], updatedBy, updatedAt: at });
  }

  removeApprovedPhrase(phrase: string, updatedBy: string, at: Date): BrandKit {
    return this.clone({
      approvedPhrases: this.props.approvedPhrases.filter(p => p !== phrase),
      updatedBy,
      updatedAt: at,
    });
  }

  addBannedPhrase(phrase: string, updatedBy: string, at: Date): BrandKit {
    if (!phrase.trim()) throw new Error('phrase cannot be empty');
    if (this.props.bannedPhrases.includes(phrase)) return this;
    return this.clone({ bannedPhrases: [...this.props.bannedPhrases, phrase], updatedBy, updatedAt: at });
  }

  addHashtag(hashtag: string, updatedBy: string, at: Date): BrandKit {
    if (!hashtag.startsWith('#')) throw new Error('hashtag must start with #');
    if (this.props.defaultHashtags.includes(hashtag)) return this;
    return this.clone({ defaultHashtags: [...this.props.defaultHashtags, hashtag], updatedBy, updatedAt: at });
  }

  removeHashtag(hashtag: string, updatedBy: string, at: Date): BrandKit {
    return this.clone({
      defaultHashtags: this.props.defaultHashtags.filter(h => h !== hashtag),
      updatedBy,
      updatedAt: at,
    });
  }

  updateColors(
    primary: string,
    secondary: string,
    accent: string,
    updatedBy: string,
    at: Date,
  ): BrandKit {
    if (!HEX_RE.test(primary))   throw new Error('primary must be a valid hex color');
    if (!HEX_RE.test(secondary)) throw new Error('secondary must be a valid hex color');
    if (!HEX_RE.test(accent))    throw new Error('accent must be a valid hex color');
    return this.clone({ primaryColor: primary, secondaryColor: secondary, accentColor: accent, updatedBy, updatedAt: at });
  }

  toJSON(): BrandKitProps {
    return { ...this.props };
  }
}
