// Banner media asset — DAM entry backed by PhotoPrism or Strapi media library
// Tracks file metadata, social-media aspect-ratio variants, copyright, expiry

export type MediaAssetType = "image" | "video" | "gif" | "svg" | "lottie" | "font";
export type MediaStatus = "uploading" | "processing" | "ready" | "error" | "archived";

export interface SocialVariant {
  platform: string;    // "instagram_square", "facebook_cover", "x_banner"
  width: number;
  height: number;
  url?: string;        // set after resizing job completes
}

// Standard social-media aspect-ratio requirements
export const SOCIAL_VARIANTS: Omit<SocialVariant, "url">[] = [
  { platform: "facebook_cover",       width: 1200, height: 630  },
  { platform: "instagram_square",     width: 1080, height: 1080 },
  { platform: "instagram_story",      width: 1080, height: 1920 },
  { platform: "x_banner",             width: 1600, height: 900  },
  { platform: "linkedin_article",     width: 1200, height: 627  },
  { platform: "pinterest_pin",        width: 1000, height: 1500 },
  { platform: "youtube_thumbnail",    width: 1280, height: 720  },
  { platform: "tiktok_vertical",      width: 1080, height: 1920 },
];

export interface BannerMediaProps {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  assetType: MediaAssetType;
  fileSize: number;          // bytes
  width?: number;            // pixels
  height?: number;           // pixels
  durationSeconds?: number;  // for video/gif
  url: string;
  thumbnailUrl?: string;
  cdnUrl?: string;
  status: MediaStatus;
  folderId?: string;
  folderPath?: string;
  tags: string[];
  altText: string;
  copyright?: string;
  licenseType?: string;      // "royalty-free", "CC0", "purchased"
  expiresAt?: Date;
  socialVariants: SocialVariant[];

  // External IDs
  photoprismId?: string;
  strapiMediaId?: string;

  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BannerMedia {
  constructor(private props: BannerMediaProps) {
    if (!props.fileName.trim()) throw new Error("File name required");
    if (!props.url.trim()) throw new Error("URL required");
    if (!props.altText.trim()) throw new Error("Alt text required for accessibility");
    if (props.fileSize < 0) throw new Error("File size cannot be negative");
    if (props.width !== undefined && props.width <= 0) throw new Error("Width must be positive");
    if (props.height !== undefined && props.height <= 0) throw new Error("Height must be positive");
    if (props.expiresAt && props.expiresAt <= props.createdAt)
      throw new Error("Expiry must be after upload date");
  }

  get id()              { return this.props.id; }
  get fileName()        { return this.props.fileName; }
  get originalName()    { return this.props.originalName; }
  get assetType()       { return this.props.assetType; }
  get mimeType()        { return this.props.mimeType; }
  get fileSize()        { return this.props.fileSize; }
  get width()           { return this.props.width; }
  get height()          { return this.props.height; }
  get url()             { return this.props.url; }
  get thumbnailUrl()    { return this.props.thumbnailUrl; }
  get cdnUrl()          { return this.props.cdnUrl; }
  get status()          { return this.props.status; }
  get tags()            { return [...this.props.tags]; }
  get altText()         { return this.props.altText; }
  get copyright()       { return this.props.copyright; }
  get expiresAt()       { return this.props.expiresAt; }
  get photoprismId()    { return this.props.photoprismId; }
  get socialVariants()  { return this.props.socialVariants.map(v => ({ ...v })); }

  isReady(): boolean { return this.props.status === "ready"; }

  isExpired(): boolean {
    return this.props.expiresAt !== undefined && this.props.expiresAt < new Date();
  }

  fileSizeMB(): number {
    return Math.round((this.props.fileSize / (1024 * 1024)) * 100) / 100;
  }

  aspectRatio(): string | null {
    if (!this.props.width || !this.props.height) return null;
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const d = gcd(this.props.width, this.props.height);
    return `${this.props.width / d}:${this.props.height / d}`;
  }

  hasVariantFor(platform: string): boolean {
    return this.props.socialVariants.some(v => v.platform === platform && v.url !== undefined);
  }

  markReady(): BannerMedia {
    return new BannerMedia({ ...this.props, status: "ready", updatedAt: new Date() });
  }

  markError(): BannerMedia {
    return new BannerMedia({ ...this.props, status: "error", updatedAt: new Date() });
  }

  archive(): BannerMedia {
    if (this.props.status === "archived") throw new Error("Already archived");
    return new BannerMedia({ ...this.props, status: "archived", updatedAt: new Date() });
  }

  addSocialVariant(variant: SocialVariant): BannerMedia {
    const filtered = this.props.socialVariants.filter(v => v.platform !== variant.platform);
    return new BannerMedia({ ...this.props, socialVariants: [...filtered, variant], updatedAt: new Date() });
  }

  addTag(tag: string): BannerMedia {
    if (this.props.tags.includes(tag)) return this;
    return new BannerMedia({ ...this.props, tags: [...this.props.tags, tag], updatedAt: new Date() });
  }

  linkPhotoprism(id: string): BannerMedia {
    return new BannerMedia({ ...this.props, photoprismId: id, updatedAt: new Date() });
  }

  linkStrapi(mediaId: string): BannerMedia {
    return new BannerMedia({ ...this.props, strapiMediaId: mediaId, updatedAt: new Date() });
  }

  toJSON(): BannerMediaProps {
    return { ...this.props, tags: [...this.props.tags], socialVariants: this.props.socialVariants.map(v => ({ ...v })) };
  }
}
