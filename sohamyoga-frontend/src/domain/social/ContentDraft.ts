// Content draft — state machine: DRAFT→REVIEW→APPROVED→SCHEDULED→PUBLISHED/FAILED
// Every post requires explicit approval before publish. No autonomous publishing.

import type { SocialPlatform } from "./SocialAccount";

export type DraftStatus =
  | "draft"
  | "review_requested"
  | "approved"
  | "rejected"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "paused";

export type ContentType = "text" | "image" | "video" | "carousel" | "story" | "reel" | "short";

export interface PlatformVariant {
  platform: SocialPlatform;
  accountId: string;
  text: string;            // platform-adapted copy
  hashtags: string[];
  mediaUrls: string[];
  scheduledAt?: Date;
  publishedAt?: Date;
  platformPostId?: string;
  status: "pending" | "scheduled" | "published" | "failed" | "skipped";
  errorMessage?: string;
  retryCount: number;
}

export interface ContentDraftProps {
  id: string;
  workspaceId: string;
  campaignId?: string;
  masterText: string;          // source text before adaptation
  contentType: ContentType;
  masterMediaUrls: string[];
  platforms: PlatformVariant[];

  // Approval
  status: DraftStatus;
  createdBy: string;
  reviewRequestedAt?: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  approvalNote?: string;

  // Scheduling
  defaultScheduleAt?: Date;
  timezone: string;

  // AI generation metadata
  generatedWithAI: boolean;
  aiPromptUsed?: string;
  aiModel?: string;

  // Tags
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class ContentDraft {
  constructor(private props: ContentDraftProps) {
    if (!props.masterText.trim() && props.contentType === "text")
      throw new Error("Text content requires master text");
    if (props.platforms.length === 0)
      throw new Error("At least one target platform required");
  }

  get id()             { return this.props.id; }
  get status()         { return this.props.status; }
  get masterText()     { return this.props.masterText; }
  get contentType()    { return this.props.contentType; }
  get platforms()      { return this.props.platforms.map(p => ({ ...p, hashtags: [...p.hashtags], mediaUrls: [...p.mediaUrls] })); }
  get createdBy()      { return this.props.createdBy; }
  get campaignId()     { return this.props.campaignId; }
  get tags()           { return [...this.props.tags]; }
  get generatedWithAI(){ return this.props.generatedWithAI; }
  get defaultScheduleAt(){ return this.props.defaultScheduleAt; }
  get reviewedBy()     { return this.props.reviewedBy; }
  get rejectionReason(){ return this.props.rejectionReason; }

  // --- State transitions ---

  requestReview(): ContentDraft {
    if (this.props.status !== "draft" && this.props.status !== "rejected")
      throw new Error(`Cannot request review from status: ${this.props.status}`);
    return new ContentDraft({ ...this.props, status: "review_requested", reviewRequestedAt: new Date(), updatedAt: new Date() });
  }

  approve(reviewedBy: string, note?: string): ContentDraft {
    if (this.props.status !== "review_requested")
      throw new Error("Can only approve content under review");
    return new ContentDraft({ ...this.props, status: "approved", reviewedBy, approvalNote: note, reviewedAt: new Date(), updatedAt: new Date() });
  }

  reject(reviewedBy: string, reason: string): ContentDraft {
    if (this.props.status !== "review_requested")
      throw new Error("Can only reject content under review");
    if (!reason.trim()) throw new Error("Rejection reason required");
    return new ContentDraft({ ...this.props, status: "rejected", reviewedBy, rejectionReason: reason, reviewedAt: new Date(), updatedAt: new Date() });
  }

  schedule(at: Date): ContentDraft {
    if (this.props.status !== "approved")
      throw new Error("Content must be approved before scheduling");
    if (at <= new Date()) throw new Error("Scheduled time must be in the future");
    return new ContentDraft({ ...this.props, status: "scheduled", defaultScheduleAt: at, updatedAt: new Date() });
  }

  markPublishing(): ContentDraft {
    if (!["approved", "scheduled"].includes(this.props.status))
      throw new Error(`Cannot publish from status: ${this.props.status}`);
    return new ContentDraft({ ...this.props, status: "publishing", updatedAt: new Date() });
  }

  markPublished(): ContentDraft {
    return new ContentDraft({ ...this.props, status: "published", updatedAt: new Date() });
  }

  markFailed(): ContentDraft {
    return new ContentDraft({ ...this.props, status: "failed", updatedAt: new Date() });
  }

  pause(): ContentDraft {
    if (this.props.status !== "scheduled")
      throw new Error("Only scheduled posts can be paused");
    return new ContentDraft({ ...this.props, status: "paused", updatedAt: new Date() });
  }

  resume(): ContentDraft {
    if (this.props.status !== "paused") throw new Error("Only paused posts can be resumed");
    return new ContentDraft({ ...this.props, status: "scheduled", updatedAt: new Date() });
  }

  // Platform variant helpers
  platformVariant(platform: SocialPlatform): PlatformVariant | undefined {
    return this.props.platforms.find(p => p.platform === platform);
  }

  publishedCount(): number {
    return this.props.platforms.filter(p => p.status === "published").length;
  }

  failedPlatforms(): SocialPlatform[] {
    return this.props.platforms.filter(p => p.status === "failed").map(p => p.platform);
  }

  isFullyPublished(): boolean {
    return this.props.platforms.every(p => p.status === "published" || p.status === "skipped");
  }

  canRetry(): boolean {
    return this.props.status === "failed" &&
      this.props.platforms.some(p => p.status === "failed" && p.retryCount < 3);
  }

  toJSON(): ContentDraftProps {
    return {
      ...this.props,
      platforms: this.props.platforms.map(p => ({ ...p, hashtags: [...p.hashtags], mediaUrls: [...p.mediaUrls] })),
      masterMediaUrls: [...this.props.masterMediaUrls],
      tags: [...this.props.tags],
    };
  }
}
