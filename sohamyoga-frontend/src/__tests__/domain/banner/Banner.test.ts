import { Banner } from "@/domain/banner/Banner";

const base = {
  id: "b1",
  title: "Summer Yoga Retreat",
  slug: "summer-yoga-retreat",
  type: "hero" as const,
  mediaType: "image" as const,
  mediaUrl: "https://cdn.sohamyoga.com/banners/summer-2026.jpg",
  altText: "Students in morning sun salutation",
  status: "draft" as const,
  tags: ["summer", "retreat"],
  isFeatured: false,
  isFavorite: false,
  timezone: "America/Toronto",
  isRecurring: false,
  hasCountdown: false,
  hasGradientOverlay: false,
  isGlassCard: false,
  sortOrder: 1,
  viewCount: 0,
  clickCount: 0,
  version: 1,
  isPublished: false,
  notes: "",
  createdBy: "admin1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Banner", () => {
  it("creates valid banner", () => {
    const b = new Banner(base);
    expect(b.title).toBe("Summer Yoga Retreat");
    expect(b.status).toBe("draft");
    expect(b.version).toBe(1);
  });

  it("throws on blank title", () => {
    expect(() => new Banner({ ...base, title: " " })).toThrow("Banner title required");
  });

  it("throws on invalid slug", () => {
    expect(() => new Banner({ ...base, slug: "Has Spaces!" })).toThrow("Slug must be lowercase letters, numbers, and hyphens");
  });

  it("throws on blank mediaUrl", () => {
    expect(() => new Banner({ ...base, mediaUrl: "" })).toThrow("Media URL required");
  });

  it("throws on blank altText", () => {
    expect(() => new Banner({ ...base, altText: "  " })).toThrow("Alt text required for accessibility");
  });

  it("throws on zero autoRotateSeconds", () => {
    expect(() => new Banner({ ...base, autoRotateSeconds: 0 })).toThrow("Auto-rotate seconds must be >= 1");
  });

  it("throws when schedule end <= start", () => {
    const start = new Date("2026-08-01");
    expect(() => new Banner({ ...base, scheduledStartAt: start, scheduledEndAt: start })).toThrow("Schedule end must be after start");
  });

  it("throws on negative viewCount", () => {
    expect(() => new Banner({ ...base, viewCount: -1 })).toThrow("View count cannot be negative");
  });

  it("ctr — 0 when no views", () => {
    expect(new Banner(base).ctr()).toBe(0);
  });

  it("ctr — 2.50 for 25 clicks / 1000 views", () => {
    const b = new Banner({ ...base, viewCount: 1000, clickCount: 25 });
    expect(b.ctr()).toBe(2.5);
  });

  it("isScheduled — false with no dates", () => {
    expect(new Banner(base).isScheduled()).toBe(false);
  });

  it("isScheduled — true with both dates", () => {
    const b = new Banner({ ...base, scheduledStartAt: new Date("2026-09-01"), scheduledEndAt: new Date("2026-09-30") });
    expect(b.isScheduled()).toBe(true);
  });

  it("isExpired — false with future end date", () => {
    const b = new Banner({ ...base, scheduledEndAt: new Date("2030-01-01") });
    expect(b.isExpired()).toBe(false);
  });

  it("isExpired — true with past end date", () => {
    const b = new Banner({ ...base, scheduledEndAt: new Date("2020-01-01") });
    expect(b.isExpired()).toBe(true);
  });

  it("isLive — true when active and not expired", () => {
    const b = new Banner({ ...base, status: "active", scheduledEndAt: new Date("2030-01-01") });
    expect(b.isLive()).toBe(true);
  });

  it("isPersonalized — false when no personalization", () => {
    expect(new Banner(base).isPersonalized()).toBe(false);
  });

  it("isPersonalized — true when country target set", () => {
    const b = new Banner({ ...base, personalization: { countries: ["CA", "US"] } });
    expect(b.isPersonalized()).toBe(true);
  });

  it("canPublish — false when draft", () => {
    expect(new Banner(base).canPublish()).toBe(false);
  });

  it("canPublish — true when approved", () => {
    expect(new Banner({ ...base, status: "approved" }).canPublish()).toBe(true);
  });

  // --- State machine ---
  it("submit — draft → pending_approval", () => {
    const b = new Banner(base).submit();
    expect(b.status).toBe("pending_approval");
  });

  it("submit — throws if not draft", () => {
    const b = new Banner({ ...base, status: "active" });
    expect(() => b.submit()).toThrow("Only draft banners can be submitted");
  });

  it("approve — pending → approved, bumps version", () => {
    const b = new Banner(base).submit().approve("admin1");
    expect(b.status).toBe("approved");
    expect(b.version).toBe(2);
    expect(b.approvedBy).toBe("admin1");
  });

  it("approve — throws on empty approver", () => {
    const b = new Banner(base).submit();
    expect(() => b.approve("  ")).toThrow("Approver ID required");
  });

  it("approve — throws if not pending", () => {
    expect(() => new Banner(base).approve("admin1")).toThrow("Only pending banners can be approved");
  });

  it("reject — reverts to draft with reason", () => {
    const b = new Banner(base).submit().reject("Wrong colours");
    expect(b.status).toBe("draft");
    expect(b.rejectionReason).toBe("Wrong colours");
  });

  it("reject — requires reason", () => {
    expect(() => new Banner(base).submit().reject("")).toThrow("Rejection reason required");
  });

  it("schedule — approved → scheduled", () => {
    const b = new Banner(base).submit().approve("admin1")
      .schedule(new Date("2026-09-01"), new Date("2026-09-30"));
    expect(b.status).toBe("scheduled");
  });

  it("schedule — throws when end <= start", () => {
    const d = new Date("2026-09-01");
    const b = new Banner(base).submit().approve("admin1");
    expect(() => b.schedule(d, d)).toThrow("Schedule end must be after start");
  });

  it("activate — approved → active", () => {
    const b = new Banner(base).submit().approve("admin1").activate();
    expect(b.status).toBe("active");
    expect(b.isPublished).toBe(true);
  });

  it("pause — requires reason", () => {
    const b = new Banner(base).submit().approve("admin1").activate();
    expect(() => b.pause("")).toThrow("Pause reason required");
  });

  it("pause — active → paused", () => {
    const b = new Banner(base).submit().approve("admin1").activate().pause("A/B test");
    expect(b.status).toBe("paused");
    expect(b.pauseReason).toBe("A/B test");
  });

  it("archive — any status → archived", () => {
    expect(new Banner(base).archive().status).toBe("archived");
  });

  it("archive — throws if already archived", () => {
    expect(() => new Banner({ ...base, status: "archived" }).archive()).toThrow("Already archived");
  });

  it("recordView — increments viewCount", () => {
    const b = new Banner(base).recordView().recordView();
    expect(b.viewCount).toBe(2);
  });

  it("recordClick — increments clickCount", () => {
    const b = new Banner(base).recordClick();
    expect(b.clickCount).toBe(1);
  });

  it("addTag — appends tag", () => {
    const b = new Banner(base).addTag("festival");
    expect(b.tags).toContain("festival");
  });

  it("addTag — idempotent on duplicate", () => {
    const b = new Banner(base).addTag("summer").addTag("summer");
    expect(b.tags.filter(t => t === "summer")).toHaveLength(1);
  });

  it("removeTag — removes by value", () => {
    const b = new Banner(base).removeTag("summer");
    expect(b.tags).not.toContain("summer");
  });

  it("toggleFavorite — flips isFavorite", () => {
    expect(new Banner(base).toggleFavorite().isFavorite).toBe(true);
    expect(new Banner(base).toggleFavorite().toggleFavorite().isFavorite).toBe(false);
  });

  it("linkStrapi — stores ID", () => {
    expect(new Banner(base).linkStrapi("strapi_42").strapiId).toBe("strapi_42");
  });

  it("immutable — submit does not modify original", () => {
    const b = new Banner(base);
    b.submit();
    expect(b.status).toBe("draft");
  });

  it("defensive copy — mutating tags does not affect internal state", () => {
    const b = new Banner(base);
    b.tags.push("injected");
    expect(b.tags).toHaveLength(2);
  });
});
