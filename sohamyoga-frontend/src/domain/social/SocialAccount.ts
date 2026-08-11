// Social account connection — OAuth tokens, health state, per-platform config

export type SocialPlatform =
  | "facebook" | "instagram" | "linkedin" | "x_twitter" | "threads"
  | "tiktok" | "youtube" | "reddit" | "pinterest" | "bluesky"
  | "mastodon" | "discord" | "slack" | "telegram" | "whatsapp_business"
  | "google_business"
  | "tumblr" | "medium" | "dribbble" | "twitch";

export type AccountStatus = "connected" | "expired" | "revoked" | "error" | "pending_auth";
export type PostizSupported = "postiz" | "custom_connector" | "manual_only";

export interface PlatformConfig {
  platform: SocialPlatform;
  displayName: string;
  postizSupport: PostizSupported;
  maxCharacters: number;
  supportsImages: boolean;
  supportsVideo: boolean;
  supportsCarousel: boolean;
  supportsScheduling: boolean;
  requiresApproval: boolean;   // always true for this portal
  notes: string;
}

export interface SocialAccountProps {
  id: string;
  workspaceId: string;
  platform: SocialPlatform;
  accountName: string;           // "SohamYoga Facebook Page"
  platformAccountId: string;     // platform-native ID
  profileUrl?: string;
  avatarUrl?: string;
  accessToken: string;           // encrypted at rest
  refreshToken?: string;
  tokenExpiresAt?: Date;
  scopes: string[];
  status: AccountStatus;
  lastHealthCheckAt?: Date;
  errorMessage?: string;
  postizAccountId?: string;      // Postiz internal ID after sync
  connectedBy: string;           // userId
  connectedAt: Date;
  updatedAt: Date;
}

export class SocialAccount {
  constructor(private props: SocialAccountProps) {
    if (!props.accountName.trim()) throw new Error("Account name required");
    if (!props.platformAccountId.trim()) throw new Error("Platform account ID required");
  }

  get id()                { return this.props.id; }
  get platform()          { return this.props.platform; }
  get accountName()       { return this.props.accountName; }
  get status()            { return this.props.status; }
  get tokenExpiresAt()    { return this.props.tokenExpiresAt; }
  get postizAccountId()   { return this.props.postizAccountId; }
  get scopes()            { return [...this.props.scopes]; }

  isTokenExpired(): boolean {
    if (!this.props.tokenExpiresAt) return false;
    return this.props.tokenExpiresAt < new Date();
  }

  isHealthy(): boolean {
    return this.props.status === "connected" && !this.isTokenExpired();
  }

  daysUntilExpiry(): number | null {
    if (!this.props.tokenExpiresAt) return null;
    return Math.floor((this.props.tokenExpiresAt.getTime() - Date.now()) / 86400000);
  }

  markExpired(): SocialAccount {
    return new SocialAccount({ ...this.props, status: "expired", updatedAt: new Date() });
  }

  markRevoked(): SocialAccount {
    return new SocialAccount({ ...this.props, status: "revoked", accessToken: "", refreshToken: undefined, updatedAt: new Date() });
  }

  markError(msg: string): SocialAccount {
    return new SocialAccount({ ...this.props, status: "error", errorMessage: msg, updatedAt: new Date() });
  }

  refreshed(newToken: string, expiresAt: Date): SocialAccount {
    return new SocialAccount({ ...this.props, accessToken: newToken, tokenExpiresAt: expiresAt, status: "connected", errorMessage: undefined, updatedAt: new Date() });
  }

  toJSON(): Omit<SocialAccountProps, "accessToken" | "refreshToken"> {
    const { accessToken: _, refreshToken: __, ...safe } = this.props;
    return { ...safe, scopes: [...this.props.scopes] };
  }
}

// Platform capability matrix
export const PLATFORM_CONFIG: Record<SocialPlatform, PlatformConfig> = {
  facebook:          { platform: "facebook",         displayName: "Facebook Pages",      postizSupport: "postiz",           maxCharacters: 63206, supportsImages: true,  supportsVideo: true,  supportsCarousel: true,  supportsScheduling: true,  requiresApproval: true, notes: "Requires Facebook Page (not personal profile)" },
  instagram:         { platform: "instagram",        displayName: "Instagram Business",  postizSupport: "postiz",           maxCharacters: 2200,  supportsImages: true,  supportsVideo: true,  supportsCarousel: true,  supportsScheduling: true,  requiresApproval: true, notes: "Requires Instagram Business or Creator account" },
  linkedin:          { platform: "linkedin",         displayName: "LinkedIn",            postizSupport: "postiz",           maxCharacters: 3000,  supportsImages: true,  supportsVideo: true,  supportsCarousel: true,  supportsScheduling: true,  requiresApproval: true, notes: "Profile and Company Page supported" },
  x_twitter:         { platform: "x_twitter",        displayName: "X / Twitter",         postizSupport: "postiz",           maxCharacters: 280,   supportsImages: true,  supportsVideo: true,  supportsCarousel: false, supportsScheduling: true,  requiresApproval: true, notes: "API v2; paid tier required for write access" },
  threads:           { platform: "threads",          displayName: "Threads",             postizSupport: "postiz",           maxCharacters: 500,   supportsImages: true,  supportsVideo: true,  supportsCarousel: false, supportsScheduling: true,  requiresApproval: true, notes: "Meta Threads API" },
  tiktok:            { platform: "tiktok",           displayName: "TikTok",              postizSupport: "postiz",           maxCharacters: 2200,  supportsImages: false, supportsVideo: true,  supportsCarousel: false, supportsScheduling: true,  requiresApproval: true, notes: "Requires TikTok for Developers app approval" },
  youtube:           { platform: "youtube",          displayName: "YouTube",             postizSupport: "postiz",           maxCharacters: 5000,  supportsImages: false, supportsVideo: true,  supportsCarousel: false, supportsScheduling: true,  requiresApproval: true, notes: "Video uploads and Shorts" },
  reddit:            { platform: "reddit",           displayName: "Reddit",              postizSupport: "postiz",           maxCharacters: 40000, supportsImages: true,  supportsVideo: true,  supportsCarousel: false, supportsScheduling: true,  requiresApproval: true, notes: "Subreddit posting requires mod or contributor status" },
  pinterest:         { platform: "pinterest",        displayName: "Pinterest",           postizSupport: "postiz",           maxCharacters: 500,   supportsImages: true,  supportsVideo: true,  supportsCarousel: false, supportsScheduling: true,  requiresApproval: true, notes: "Pins on boards" },
  bluesky:           { platform: "bluesky",          displayName: "Bluesky (AT Protocol)",postizSupport: "postiz",          maxCharacters: 300,   supportsImages: true,  supportsVideo: false, supportsCarousel: false, supportsScheduling: true,  requiresApproval: true, notes: "AT Protocol; no OAuth, uses app password" },
  mastodon:          { platform: "mastodon",         displayName: "Mastodon",            postizSupport: "postiz",           maxCharacters: 500,   supportsImages: true,  supportsVideo: true,  supportsCarousel: false, supportsScheduling: true,  requiresApproval: true, notes: "Federated; requires instance URL" },
  discord:           { platform: "discord",          displayName: "Discord",             postizSupport: "postiz",           maxCharacters: 2000,  supportsImages: true,  supportsVideo: true,  supportsCarousel: false, supportsScheduling: true,  requiresApproval: true, notes: "Webhook or bot posting to channels" },
  slack:             { platform: "slack",            displayName: "Slack",               postizSupport: "postiz",           maxCharacters: 40000, supportsImages: true,  supportsVideo: true,  supportsCarousel: false, supportsScheduling: true,  requiresApproval: true, notes: "Workspace channel posting" },
  telegram:          { platform: "telegram",         displayName: "Telegram",            postizSupport: "custom_connector", maxCharacters: 4096,  supportsImages: true,  supportsVideo: true,  supportsCarousel: false, supportsScheduling: true,  requiresApproval: true, notes: "Bot API; channel and group posting" },
  whatsapp_business: { platform: "whatsapp_business",displayName: "WhatsApp Business",   postizSupport: "custom_connector", maxCharacters: 4096,  supportsImages: true,  supportsVideo: true,  supportsCarousel: false, supportsScheduling: false, requiresApproval: true, notes: "Meta Business API; requires WABA approval" },
  google_business:   { platform: "google_business",  displayName: "Google Business Profile",postizSupport:"custom_connector",maxCharacters: 1500,  supportsImages: true,  supportsVideo: false, supportsCarousel: false, supportsScheduling: true,  requiresApproval: true, notes: "Google My Business Posts API" },
  // maxCharacters below are each provider's real maxLength() from Postiz's
  // own source (libraries/nestjs-libraries/src/integrations/social/*.provider.ts) — not estimates.
  tumblr:            { platform: "tumblr",            displayName: "Tumblr",              postizSupport: "postiz",           maxCharacters: 32768, supportsImages: true,  supportsVideo: true,  supportsCarousel: false, supportsScheduling: true,  requiresApproval: true, notes: "Real Postiz OAuth provider — TUMBLR_CLIENT_ID/SECRET" },
  medium:            { platform: "medium",            displayName: "Medium",              postizSupport: "postiz",           maxCharacters: 100000,supportsImages: true,  supportsVideo: false, supportsCarousel: false, supportsScheduling: true,  requiresApproval: true, notes: "Real Postiz provider — no separate developer app; connect via Postiz UI" },
  dribbble:          { platform: "dribbble",          displayName: "Dribbble",            postizSupport: "postiz",           maxCharacters: 40000, supportsImages: true,  supportsVideo: false, supportsCarousel: false, supportsScheduling: true,  requiresApproval: true, notes: "Real Postiz OAuth provider — DRIBBBLE_CLIENT_ID/SECRET; image-shot platform" },
  twitch:            { platform: "twitch",            displayName: "Twitch",              postizSupport: "postiz",           maxCharacters: 500,   supportsImages: false, supportsVideo: false, supportsCarousel: false, supportsScheduling: true,  requiresApproval: true, notes: "500-char limit is a chat/announcement message, not a full post; no separate developer app" },
};
