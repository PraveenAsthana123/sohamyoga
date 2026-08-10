// Banner domain entity — full lifecycle from draft to published
// Backed by Strapi (CMS) + PhotoPrism (media) + Postiz (social publishing)

export type BannerType =
  | "hero" | "full_screen" | "slider" | "carousel" | "video"
  | "inline" | "popup" | "sidebar" | "announcement";

export type BannerMediaType = "image" | "video" | "gif" | "svg" | "lottie";

export type BannerStatus =
  | "draft" | "pending_approval" | "approved"
  | "scheduled" | "active" | "paused" | "archived" | "expired";

export type DeviceTarget = "desktop" | "tablet" | "mobile";

export interface BannerCta {
  label: string;         // "Book Now", "Learn More"
  url: string;
  style: "primary" | "secondary" | "outline" | "ghost";
  trackingId?: string;
}

export interface BannerPersonalization {
  countries?: string[];
  languages?: string[];
  membershipTiers?: string[];
  deviceTypes?: DeviceTarget[];
  isNewCustomer?: boolean;
  campaignSource?: string;
  referralSource?: string;
}

export interface BannerProps {
  id: string;
  title: string;
  slug: string;
  type: BannerType;
  mediaType: BannerMediaType;
  mediaUrl: string;
  thumbnailUrl?: string;
  altText: string;           // accessibility — mandatory
  overlayText?: string;
  headline?: string;
  subheadline?: string;
  cta?: BannerCta;
  status: BannerStatus;
  categoryId?: string;
  categoryName?: string;
  tags: string[];
  isFeatured: boolean;
  isFavorite: boolean;

  // Scheduling
  scheduledStartAt?: Date;
  scheduledEndAt?: Date;
  timezone: string;
  isRecurring: boolean;

  // Personalization
  personalization?: BannerPersonalization;

  // Display settings
  autoRotateSeconds?: number;
  hasCountdown: boolean;
  countdownEndAt?: Date;
  hasGradientOverlay: boolean;
  gradientColor?: string;
  isGlassCard: boolean;
  sortOrder: number;

  // External IDs
  strapiId?: string;
  photoprismId?: string;

  // Analytics (updated by batch job)
  viewCount: number;
  clickCount: number;

  // Versioning
  version: number;
  approvedBy?: string;
  approvedAt?: Date;
  pauseReason?: string;
  rejectionReason?: string;

  isPublished: boolean;
  publishedAt?: Date;
  archivedAt?: Date;
  notes: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Banner {
  constructor(private props: BannerProps) {
    if (!props.title.trim()) throw new Error("Banner title required");
    if (!props.slug.match(/^[a-z0-9-]+$/)) throw new Error("Slug must be lowercase letters, numbers, and hyphens");
    if (!props.mediaUrl.trim()) throw new Error("Media URL required");
    if (!props.altText.trim()) throw new Error("Alt text required for accessibility");
    if (props.autoRotateSeconds !== undefined && props.autoRotateSeconds < 1)
      throw new Error("Auto-rotate seconds must be >= 1");
    if (props.scheduledEndAt && props.scheduledStartAt && props.scheduledEndAt <= props.scheduledStartAt)
      throw new Error("Schedule end must be after start");
    if (props.viewCount < 0) throw new Error("View count cannot be negative");
    if (props.clickCount < 0) throw new Error("Click count cannot be negative");
  }

  get id()               { return this.props.id; }
  get title()            { return this.props.title; }
  get slug()             { return this.props.slug; }
  get type()             { return this.props.type; }
  get mediaType()        { return this.props.mediaType; }
  get mediaUrl()         { return this.props.mediaUrl; }
  get altText()          { return this.props.altText; }
  get status()           { return this.props.status; }
  get tags()             { return [...this.props.tags]; }
  get isFeatured()       { return this.props.isFeatured; }
  get isFavorite()       { return this.props.isFavorite; }
  get scheduledStartAt() { return this.props.scheduledStartAt; }
  get scheduledEndAt()   { return this.props.scheduledEndAt; }
  get timezone()         { return this.props.timezone; }
  get viewCount()        { return this.props.viewCount; }
  get clickCount()       { return this.props.clickCount; }
  get version()          { return this.props.version; }
  get cta()              { return this.props.cta ? { ...this.props.cta } : undefined; }
  get personalization()  { return this.props.personalization ? { ...this.props.personalization } : undefined; }
  get approvedBy()       { return this.props.approvedBy; }
  get pauseReason()      { return this.props.pauseReason; }
  get rejectionReason()  { return this.props.rejectionReason; }
  get isPublished()      { return this.props.isPublished; }
  get sortOrder()        { return this.props.sortOrder; }
  get strapiId()         { return this.props.strapiId; }
  get photoprismId()     { return this.props.photoprismId; }

  ctr(): number {
    if (this.props.viewCount === 0) return 0;
    return Math.round((this.props.clickCount / this.props.viewCount) * 10000) / 100; // 2 decimal places
  }

  isScheduled(): boolean { return !!(this.props.scheduledStartAt && this.props.scheduledEndAt); }

  isExpired(): boolean {
    return this.props.status !== "archived" &&
      this.props.scheduledEndAt !== undefined &&
      this.props.scheduledEndAt < new Date();
  }

  isLive(): boolean {
    return this.props.status === "active" && !this.isExpired();
  }

  isPersonalized(): boolean {
    const p = this.props.personalization;
    if (!p) return false;
    return !!(
      (p.countries && p.countries.length > 0) ||
      (p.languages && p.languages.length > 0) ||
      (p.membershipTiers && p.membershipTiers.length > 0) ||
      (p.deviceTypes && p.deviceTypes.length > 0) ||
      p.isNewCustomer !== undefined ||
      p.campaignSource
    );
  }

  canPublish(): boolean {
    return this.props.status === "approved" || this.props.status === "scheduled" || this.props.status === "active";
  }

  // --- State machine ---
  submit(): Banner {
    if (this.props.status !== "draft") throw new Error("Only draft banners can be submitted for approval");
    return new Banner({ ...this.props, status: "pending_approval", updatedAt: new Date() });
  }

  approve(approvedBy: string): Banner {
    if (!approvedBy.trim()) throw new Error("Approver ID required");
    if (this.props.status !== "pending_approval") throw new Error("Only pending banners can be approved");
    return new Banner({ ...this.props, status: "approved", approvedBy, approvedAt: new Date(), version: this.props.version + 1, updatedAt: new Date() });
  }

  reject(reason: string): Banner {
    if (!reason.trim()) throw new Error("Rejection reason required");
    if (this.props.status !== "pending_approval") throw new Error("Only pending banners can be rejected");
    return new Banner({ ...this.props, status: "draft", rejectionReason: reason, updatedAt: new Date() });
  }

  schedule(startAt: Date, endAt: Date): Banner {
    if (endAt <= startAt) throw new Error("Schedule end must be after start");
    if (!["approved", "draft"].includes(this.props.status)) throw new Error("Only approved banners can be scheduled");
    return new Banner({ ...this.props, status: "scheduled", scheduledStartAt: startAt, scheduledEndAt: endAt, updatedAt: new Date() });
  }

  activate(): Banner {
    if (!["approved", "scheduled", "paused"].includes(this.props.status)) throw new Error("Cannot activate from current status");
    return new Banner({ ...this.props, status: "active", isPublished: true, publishedAt: this.props.publishedAt ?? new Date(), updatedAt: new Date() });
  }

  pause(reason: string): Banner {
    if (!reason.trim()) throw new Error("Pause reason required");
    if (this.props.status !== "active") throw new Error("Only active banners can be paused");
    return new Banner({ ...this.props, status: "paused", pauseReason: reason, updatedAt: new Date() });
  }

  archive(): Banner {
    if (this.props.status === "archived") throw new Error("Already archived");
    return new Banner({ ...this.props, status: "archived", isPublished: false, archivedAt: new Date(), updatedAt: new Date() });
  }

  recordView(): Banner {
    return new Banner({ ...this.props, viewCount: this.props.viewCount + 1, updatedAt: new Date() });
  }

  recordClick(): Banner {
    return new Banner({ ...this.props, clickCount: this.props.clickCount + 1, updatedAt: new Date() });
  }

  addTag(tag: string): Banner {
    if (this.props.tags.includes(tag)) return this;
    return new Banner({ ...this.props, tags: [...this.props.tags, tag], updatedAt: new Date() });
  }

  removeTag(tag: string): Banner {
    return new Banner({ ...this.props, tags: this.props.tags.filter(t => t !== tag), updatedAt: new Date() });
  }

  toggleFavorite(): Banner {
    return new Banner({ ...this.props, isFavorite: !this.props.isFavorite, updatedAt: new Date() });
  }

  linkStrapi(strapiId: string): Banner {
    return new Banner({ ...this.props, strapiId, updatedAt: new Date() });
  }

  linkPhotoprism(photoprismId: string): Banner {
    return new Banner({ ...this.props, photoprismId, updatedAt: new Date() });
  }

  toJSON(): BannerProps {
    return { ...this.props, tags: [...this.props.tags] };
  }
}
