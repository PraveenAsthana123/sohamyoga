export type CtaType = 'form' | 'booking' | 'call' | 'whatsapp' | 'link' | 'download' | 'subscribe' | 'share' | 'custom';
export type CtaPlacement = 'hero' | 'footer' | 'sidebar' | 'inline' | 'sticky' | 'popup' | 'email' | 'other';
export type CtaRisk = 'low' | 'medium' | 'high';
export type CtaStatus = 'draft' | 'active' | 'paused' | 'archived';
export type CtaCheckStatus = 'unknown' | 'ok' | 'broken';

export interface CtaProps {
  id: string;
  label: string;
  type: CtaType;
  destinationUrl: string;
  trackingSlug: string;
  placement: CtaPlacement;
  riskClassification: CtaRisk;
  status: CtaStatus;
  clickCount: number;
  lastCheckedAt?: Date;
  lastCheckStatus: CtaCheckStatus;
  fallbackUrl?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

function isValidUrl(url: string): boolean {
  try { new URL(url); return true; } catch { return false; }
}

export class Cta {
  private readonly props: CtaProps;

  constructor(props: CtaProps) {
    if (!props.label.trim()) throw new Error('label is required');
    if (!isValidUrl(props.destinationUrl)) throw new Error('destinationUrl must be a valid absolute URL');
    if (!/^[a-z0-9-]+$/.test(props.trackingSlug)) throw new Error('trackingSlug must be lowercase letters, numbers, and hyphens');
    if (props.clickCount < 0) throw new Error('clickCount cannot be negative');
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get label() { return this.props.label; }
  get destinationUrl() { return this.props.destinationUrl; }
  get trackingSlug() { return this.props.trackingSlug; }
  get status() { return this.props.status; }
  get clickCount() { return this.props.clickCount; }
  get lastCheckStatus() { return this.props.lastCheckStatus; }
  get fallbackUrl() { return this.props.fallbackUrl; }

  activate(): Cta {
    if (this.props.lastCheckStatus === 'broken') throw new Error('Cannot activate a CTA whose destination failed its last health check.');
    return new Cta({ ...this.props, status: 'active', updatedAt: new Date() });
  }

  pause(): Cta {
    return new Cta({ ...this.props, status: 'paused', updatedAt: new Date() });
  }

  archive(): Cta {
    return new Cta({ ...this.props, status: 'archived', updatedAt: new Date() });
  }

  recordCheck(status: CtaCheckStatus): Cta {
    return new Cta({ ...this.props, lastCheckStatus: status, lastCheckedAt: new Date(), updatedAt: new Date() });
  }

  recordClick(): Cta {
    return new Cta({ ...this.props, clickCount: this.props.clickCount + 1, updatedAt: new Date() });
  }

  /** Real fallback behavior per the spec's "fallback CTA on destination failure" — never a broken link to a visitor. */
  resolveRedirectUrl(): string {
    if (this.props.lastCheckStatus === 'broken' && this.props.fallbackUrl) return this.props.fallbackUrl;
    return this.props.destinationUrl;
  }

  toJSON(): CtaProps {
    return { ...this.props };
  }
}
