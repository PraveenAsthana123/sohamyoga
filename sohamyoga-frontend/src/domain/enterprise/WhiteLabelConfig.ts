const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export type WhiteLabelStatus = 'draft' | 'active' | 'inactive';

export interface WhiteLabelConfigProps {
  id: string;
  tenantId: string;
  brandName: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;    // #RRGGBB
  secondaryColor: string;
  accentColor: string;
  customDomain?: string;
  supportEmail?: string;
  privacyPolicyUrl?: string;
  termsUrl?: string;
  status: WhiteLabelStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class WhiteLabelConfig {
  private readonly props: Readonly<WhiteLabelConfigProps>;

  constructor(props: WhiteLabelConfigProps) {
    if (!props.id.trim())        throw new Error('id is required');
    if (!props.tenantId.trim())  throw new Error('tenantId is required');
    if (!props.brandName.trim()) throw new Error('brandName is required');
    if (!HEX_COLOR_RE.test(props.primaryColor))
      throw new Error('primaryColor must be a valid hex color (#RRGGBB)');
    if (!HEX_COLOR_RE.test(props.secondaryColor))
      throw new Error('secondaryColor must be a valid hex color (#RRGGBB)');
    if (!HEX_COLOR_RE.test(props.accentColor))
      throw new Error('accentColor must be a valid hex color (#RRGGBB)');
    if (props.status === 'active' && !props.logoUrl)
      throw new Error('active config requires logoUrl');

    this.props = { ...props };
  }

  private clone(patch: Partial<WhiteLabelConfigProps>): WhiteLabelConfig {
    return new WhiteLabelConfig({ ...this.props, ...patch });
  }

  get id():               string               { return this.props.id; }
  get tenantId():         string               { return this.props.tenantId; }
  get brandName():        string               { return this.props.brandName; }
  get logoUrl():          string|undefined     { return this.props.logoUrl; }
  get faviconUrl():       string|undefined     { return this.props.faviconUrl; }
  get primaryColor():     string               { return this.props.primaryColor; }
  get secondaryColor():   string               { return this.props.secondaryColor; }
  get accentColor():      string               { return this.props.accentColor; }
  get customDomain():     string|undefined     { return this.props.customDomain; }
  get supportEmail():     string|undefined     { return this.props.supportEmail; }
  get privacyPolicyUrl(): string|undefined     { return this.props.privacyPolicyUrl; }
  get termsUrl():         string|undefined     { return this.props.termsUrl; }
  get status():           WhiteLabelStatus     { return this.props.status; }
  get createdAt():        Date                 { return this.props.createdAt; }
  get updatedAt():        Date                 { return this.props.updatedAt; }

  isDraft():    boolean { return this.props.status === 'draft'; }
  isActive():   boolean { return this.props.status === 'active'; }
  isInactive(): boolean { return this.props.status === 'inactive'; }

  activate(now: Date): WhiteLabelConfig {
    if (this.props.status === 'active')
      throw new Error('config is already active');
    if (!this.props.logoUrl)
      throw new Error('logoUrl is required to activate white-label config');
    return this.clone({ status: 'active', updatedAt: now });
  }

  deactivate(now: Date): WhiteLabelConfig {
    if (this.props.status !== 'active')
      throw new Error('can only deactivate an active config');
    return this.clone({ status: 'inactive', updatedAt: now });
  }

  setLogoUrl(url: string, now: Date): WhiteLabelConfig {
    if (!url.trim()) throw new Error('logoUrl is required');
    return this.clone({ logoUrl: url, updatedAt: now });
  }

  setFaviconUrl(url: string, now: Date): WhiteLabelConfig {
    if (!url.trim()) throw new Error('faviconUrl is required');
    return this.clone({ faviconUrl: url, updatedAt: now });
  }

  setColors(primary: string, secondary: string, accent: string, now: Date): WhiteLabelConfig {
    if (!HEX_COLOR_RE.test(primary))   throw new Error('primaryColor must be a valid hex color (#RRGGBB)');
    if (!HEX_COLOR_RE.test(secondary)) throw new Error('secondaryColor must be a valid hex color (#RRGGBB)');
    if (!HEX_COLOR_RE.test(accent))    throw new Error('accentColor must be a valid hex color (#RRGGBB)');
    return this.clone({ primaryColor: primary, secondaryColor: secondary, accentColor: accent, updatedAt: now });
  }

  setCustomDomain(domain: string, now: Date): WhiteLabelConfig {
    if (!domain.trim()) throw new Error('customDomain is required');
    return this.clone({ customDomain: domain, updatedAt: now });
  }

  setBrandName(name: string, now: Date): WhiteLabelConfig {
    if (!name.trim()) throw new Error('brandName is required');
    return this.clone({ brandName: name, updatedAt: now });
  }
}
