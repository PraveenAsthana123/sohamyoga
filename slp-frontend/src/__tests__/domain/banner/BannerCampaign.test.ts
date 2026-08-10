import { BannerCampaign } from "@/domain/banner/BannerCampaign";
import type { AbTestVariant } from "@/domain/banner/BannerCampaign";

const START = new Date("2026-09-01");
const END   = new Date("2026-09-30");

const base = {
  id: "c1",
  name: "Diwali Yoga Festival",
  type: "festival" as const,
  status: "draft" as const,
  bannerIds: ["b1", "b2"],
  startAt: START,
  endAt: END,
  timezone: "America/Toronto",
  notes: "",
  createdBy: "admin1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const variants: AbTestVariant[] = [
  { id: "v1", name: "Variant A", bannerId: "b1", trafficPercent: 60, viewCount: 600, clickCount: 18 },
  { id: "v2", name: "Variant B", bannerId: "b2", trafficPercent: 40, viewCount: 400, clickCount: 24 },
];

describe("BannerCampaign", () => {
  it("creates valid campaign", () => {
    const c = new BannerCampaign(base);
    expect(c.name).toBe("Diwali Yoga Festival");
    expect(c.status).toBe("draft");
  });

  it("throws on blank name", () => {
    expect(() => new BannerCampaign({ ...base, name: " " })).toThrow("Campaign name required");
  });

  it("throws when end == start", () => {
    expect(() => new BannerCampaign({ ...base, endAt: START })).toThrow("Campaign end must be after start");
  });

  it("throws on empty bannerIds", () => {
    expect(() => new BannerCampaign({ ...base, bannerIds: [] })).toThrow("Campaign must include at least one banner");
  });

  it("throws on negative budget", () => {
    expect(() => new BannerCampaign({ ...base, budget: -1 })).toThrow("Budget cannot be negative");
  });

  it("throws when A/B test traffic != 100", () => {
    const badVariants = [{ ...variants[0], trafficPercent: 70 }, { ...variants[1], trafficPercent: 40 }];
    expect(() => new BannerCampaign({ ...base, abTestVariants: badVariants })).toThrow("A/B test traffic must sum to 100");
  });

  it("durationDays — 29 for Sep", () => {
    expect(new BannerCampaign(base).durationDays()).toBe(29);
  });

  it("isAbTest — false without variants", () => {
    expect(new BannerCampaign(base).isAbTest()).toBe(false);
  });

  it("isAbTest — true with 2+ variants", () => {
    const c = new BannerCampaign({ ...base, abTestVariants: variants });
    expect(c.isAbTest()).toBe(true);
  });

  it("winningVariant — null without A/B test", () => {
    expect(new BannerCampaign(base).winningVariant()).toBeNull();
  });

  it("winningVariant — picks highest CTR variant", () => {
    // A: 18/600 = 3%, B: 24/400 = 6% → B wins
    const c = new BannerCampaign({ ...base, abTestVariants: variants });
    expect(c.winningVariant()?.name).toBe("Variant B");
  });

  it("isExpired — false for future campaign", () => {
    const c = new BannerCampaign({ ...base, endAt: new Date("2030-01-01") });
    expect(c.isExpired()).toBe(false);
  });

  it("isExpired — true for past campaign", () => {
    const c = new BannerCampaign({ ...base, startAt: new Date("2020-01-01"), endAt: new Date("2020-01-31") });
    expect(c.isExpired()).toBe(true);
  });

  // --- State machine ---
  it("approve — draft → approved", () => {
    const c = new BannerCampaign(base).approve("admin1");
    expect(c.status).toBe("approved");
    expect(c.approvedBy).toBe("admin1");
  });

  it("approve — throws if not draft", () => {
    expect(() => new BannerCampaign({ ...base, status: "active" }).approve("admin1")).toThrow("Only draft campaigns can be approved");
  });

  it("approve — throws on empty approver", () => {
    expect(() => new BannerCampaign(base).approve("")).toThrow("Approver ID required");
  });

  it("activate — approved → active", () => {
    const c = new BannerCampaign(base).approve("admin1").activate();
    expect(c.status).toBe("active");
    expect(c.isActive()).toBe(true);
  });

  it("activate — throws from draft", () => {
    expect(() => new BannerCampaign(base).activate()).toThrow("Can only activate approved or paused campaigns");
  });

  it("pause — requires reason", () => {
    const c = new BannerCampaign(base).approve("admin1").activate();
    expect(() => c.pause("")).toThrow("Pause reason required");
  });

  it("pause — active → paused", () => {
    const c = new BannerCampaign(base).approve("admin1").activate().pause("Off-season");
    expect(c.status).toBe("paused");
    expect(c.pauseReason).toBe("Off-season");
  });

  it("complete — active → completed", () => {
    const c = new BannerCampaign(base).approve("admin1").activate().complete();
    expect(c.status).toBe("completed");
  });

  it("archive — throws if already archived", () => {
    expect(() => new BannerCampaign({ ...base, status: "archived" }).archive()).toThrow("Already archived");
  });

  it("addBanner — appends ID", () => {
    const c = new BannerCampaign(base).addBanner("b3");
    expect(c.bannerIds).toContain("b3");
  });

  it("addBanner — idempotent on duplicate", () => {
    const c = new BannerCampaign(base).addBanner("b1");
    expect(c.bannerIds.filter(id => id === "b1")).toHaveLength(1);
  });

  it("removeBanner — removes by ID", () => {
    const c = new BannerCampaign(base).removeBanner("b2");
    expect(c.bannerIds).not.toContain("b2");
  });

  it("removeBanner — throws when only one banner remains", () => {
    const c = new BannerCampaign({ ...base, bannerIds: ["b1"] });
    expect(() => c.removeBanner("b1")).toThrow("Campaign must keep at least one banner");
  });

  it("immutable — approve does not modify original", () => {
    const c = new BannerCampaign(base);
    c.approve("admin1");
    expect(c.status).toBe("draft");
  });
});
