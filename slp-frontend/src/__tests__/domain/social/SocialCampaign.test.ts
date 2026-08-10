import { SocialCampaign } from "@/domain/social/SocialCampaign";

const baseMetrics = { totalImpressions: 0, totalReach: 0, totalClicks: 0, totalEngagements: 0, totalConversions: 0, avgEngagementRate: 0, followerDelta: 0, postsPublished: 0, postsFailed: 0, postsPending: 0 };

const base = {
  id: "sc1",
  workspaceId: "ws1",
  name: "Warrior Wednesday Campaign",
  description: "Weekly yoga challenge series",
  goal: "engagement" as const,
  status: "draft" as const,
  platforms: ["instagram", "facebook"],
  draftIds: [],
  startsAt: new Date(Date.now() + 86400000),
  endsAt: new Date(Date.now() + 86400000 * 30),
  metrics: baseMetrics,
  createdBy: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("SocialCampaign", () => {
  it("creates valid campaign", () => {
    const c = new SocialCampaign(base);
    expect(c.name).toBe("Warrior Wednesday Campaign");
    expect(c.status).toBe("draft");
  });

  it("throws on empty name", () => {
    expect(() => new SocialCampaign({ ...base, name: "" })).toThrow("Campaign name required");
  });

  it("throws when end <= start", () => {
    expect(() => new SocialCampaign({ ...base, endsAt: base.startsAt })).toThrow("End date must be after start date");
  });

  it("throws with no platforms", () => {
    expect(() => new SocialCampaign({ ...base, platforms: [] })).toThrow("At least one platform required");
  });

  it("activate — draft → active", () => {
    const c = new SocialCampaign(base).activate();
    expect(c.status).toBe("active");
  });

  it("activate — throws if not draft", () => {
    expect(() => new SocialCampaign({ ...base, status: "active" }).activate()).toThrow("Only draft campaigns can be activated");
  });

  it("pause — active → paused with reason", () => {
    const c = new SocialCampaign({ ...base, status: "active" }).pause("Brand incident");
    expect(c.status).toBe("paused");
    expect(c.pauseReason).toBe("Brand incident");
  });

  it("pause — throws with empty reason", () => {
    expect(() => new SocialCampaign({ ...base, status: "active" }).pause("  ")).toThrow("Pause reason required for audit log");
  });

  it("pause — throws if not active", () => {
    expect(() => new SocialCampaign(base).pause("reason")).toThrow("Only active campaigns can be paused");
  });

  it("resume — paused → active, clears reason", () => {
    const c = new SocialCampaign({ ...base, status: "paused", pauseReason: "incident" }).resume();
    expect(c.status).toBe("active");
    expect(c.pauseReason).toBeUndefined();
  });

  it("complete — active → completed", () => {
    const c = new SocialCampaign({ ...base, status: "active" }).complete();
    expect(c.status).toBe("completed");
  });

  it("addDraft — appends draft ID", () => {
    const c = new SocialCampaign(base).addDraft("d1");
    expect(c.draftIds).toContain("d1");
  });

  it("addDraft — idempotent for same ID", () => {
    const c = new SocialCampaign(base).addDraft("d1").addDraft("d1");
    expect(c.draftIds).toHaveLength(1);
  });

  it("engagementRate — 0 when no reach", () => {
    expect(new SocialCampaign(base).engagementRate()).toBe(0);
  });

  it("engagementRate — correct when data present", () => {
    const c = new SocialCampaign(base).updateMetrics({ totalEngagements: 1000, totalReach: 20000 });
    expect(c.engagementRate()).toBe(5); // 1000/20000 * 100
  });

  it("daysRemaining — positive for future campaign", () => {
    expect(new SocialCampaign(base).daysRemaining()).toBeGreaterThan(0);
  });

  it("immutable — activate does not modify original", () => {
    const c = new SocialCampaign(base);
    c.activate();
    expect(c.status).toBe("draft");
  });
});
