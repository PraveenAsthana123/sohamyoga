import { ContentDraft } from "@/domain/social/ContentDraft";
import type { PlatformVariant } from "@/domain/social/ContentDraft";

const variant = (platform: string): PlatformVariant => ({
  platform: platform as any,
  accountId: "acc1",
  text: `Post for ${platform}`,
  hashtags: ["#yoga"],
  mediaUrls: [],
  status: "pending",
  retryCount: 0,
});

const base = {
  id: "d1",
  workspaceId: "ws1",
  masterText: "Join our Sun Salutation morning class!",
  contentType: "text" as const,
  masterMediaUrls: [],
  platforms: [variant("instagram"), variant("facebook")],
  status: "draft" as const,
  createdBy: "admin",
  timezone: "UTC",
  generatedWithAI: true,
  tags: ["morning", "hatha"],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ContentDraft", () => {
  it("creates valid draft", () => {
    const d = new ContentDraft(base);
    expect(d.status).toBe("draft");
    expect(d.masterText).toBe("Join our Sun Salutation morning class!");
  });

  it("throws when no platforms", () => {
    expect(() => new ContentDraft({ ...base, platforms: [] })).toThrow("At least one target platform required");
  });

  it("throws when text empty for text content", () => {
    expect(() => new ContentDraft({ ...base, masterText: "  ", contentType: "text" })).toThrow("Text content requires master text");
  });

  // --- requestReview ---
  it("requestReview — moves draft to review_requested", () => {
    const d = new ContentDraft(base).requestReview();
    expect(d.status).toBe("review_requested");
  });

  it("requestReview — throws if not draft or rejected", () => {
    const d = new ContentDraft({ ...base, status: "published" });
    expect(() => d.requestReview()).toThrow("Cannot request review from status: published");
  });

  it("requestReview — allowed from rejected state", () => {
    const d = new ContentDraft({ ...base, status: "rejected" }).requestReview();
    expect(d.status).toBe("review_requested");
  });

  // --- approve ---
  it("approve — moves review_requested to approved", () => {
    const d = new ContentDraft({ ...base, status: "review_requested" }).approve("reviewer1", "Looks good");
    expect(d.status).toBe("approved");
    expect(d.reviewedBy).toBe("reviewer1");
  });

  it("approve — throws if not under review", () => {
    expect(() => new ContentDraft(base).approve("r1")).toThrow("Can only approve content under review");
  });

  // --- reject ---
  it("reject — moves to rejected with reason", () => {
    const d = new ContentDraft({ ...base, status: "review_requested" }).reject("r1", "Wrong hashtags");
    expect(d.status).toBe("rejected");
    expect(d.rejectionReason).toBe("Wrong hashtags");
  });

  it("reject — throws with empty reason", () => {
    expect(() => new ContentDraft({ ...base, status: "review_requested" }).reject("r1", "  ")).toThrow("Rejection reason required");
  });

  // --- schedule ---
  it("schedule — moves approved to scheduled", () => {
    const future = new Date(Date.now() + 86400000);
    const d = new ContentDraft({ ...base, status: "approved" }).schedule(future);
    expect(d.status).toBe("scheduled");
    expect(d.defaultScheduleAt).toEqual(future);
  });

  it("schedule — throws if not approved", () => {
    expect(() => new ContentDraft(base).schedule(new Date(Date.now() + 86400000))).toThrow("Content must be approved before scheduling");
  });

  it("schedule — throws if time is in the past", () => {
    const past = new Date(Date.now() - 1000);
    expect(() => new ContentDraft({ ...base, status: "approved" }).schedule(past)).toThrow("Scheduled time must be in the future");
  });

  // --- pause / resume ---
  it("pause — scheduled → paused", () => {
    const d = new ContentDraft({ ...base, status: "scheduled" }).pause();
    expect(d.status).toBe("paused");
  });

  it("pause — throws if not scheduled", () => {
    expect(() => new ContentDraft(base).pause()).toThrow("Only scheduled posts can be paused");
  });

  it("resume — paused → scheduled", () => {
    const d = new ContentDraft({ ...base, status: "paused" }).resume();
    expect(d.status).toBe("scheduled");
  });

  // --- published helpers ---
  it("publishedCount — 0 initially", () => {
    expect(new ContentDraft(base).publishedCount()).toBe(0);
  });

  it("failedPlatforms — returns failed platform list", () => {
    const p = [variant("instagram"), { ...variant("facebook"), status: "failed" as const }];
    const d = new ContentDraft({ ...base, platforms: p });
    expect(d.failedPlatforms()).toEqual(["facebook"]);
  });

  it("canRetry — false when not failed", () => {
    expect(new ContentDraft(base).canRetry()).toBe(false);
  });

  it("canRetry — true when failed and retries < 3", () => {
    const p = [{ ...variant("instagram"), status: "failed" as const, retryCount: 1 }];
    const d = new ContentDraft({ ...base, status: "failed", platforms: p });
    expect(d.canRetry()).toBe(true);
  });

  it("returns defensive copy of platforms", () => {
    const d = new ContentDraft(base);
    const plats = d.platforms;
    plats.push(variant("linkedin"));
    expect(d.platforms).toHaveLength(2);
  });

  it("immutability — approve does not modify original", () => {
    const d = new ContentDraft({ ...base, status: "review_requested" });
    d.approve("r1");
    expect(d.status).toBe("review_requested");
  });
});
