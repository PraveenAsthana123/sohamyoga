import { BannerAnalytics } from "@/domain/banner/BannerAnalytics";

const base = {
  id: "a1",
  bannerId: "b1",
  bannerTitle: "Summer Yoga Retreat",
  period: "daily" as const,
  date: new Date("2026-08-15"),
  views: 1000,
  clicks: 45,
  conversions: 9,
  revenue: 450,
  currency: "CAD",
  deviceBreakdown: { desktop: 500, tablet: 200, mobile: 300 },
  topCountries: [
    { code: "CA", name: "Canada",        views: 600, clicks: 28 },
    { code: "US", name: "United States", views: 250, clicks: 12 },
  ],
  createdAt: new Date(),
};

describe("BannerAnalytics", () => {
  it("creates valid analytics record", () => {
    const a = new BannerAnalytics(base);
    expect(a.views).toBe(1000);
    expect(a.clicks).toBe(45);
  });

  it("throws on blank banner ID", () => {
    expect(() => new BannerAnalytics({ ...base, bannerId: "" })).toThrow("Banner ID required");
  });

  it("throws on negative views", () => {
    expect(() => new BannerAnalytics({ ...base, views: -1 })).toThrow("Views cannot be negative");
  });

  it("throws when clicks > views", () => {
    expect(() => new BannerAnalytics({ ...base, clicks: 1001 })).toThrow("Clicks cannot exceed views");
  });

  it("throws when conversions > clicks", () => {
    expect(() => new BannerAnalytics({ ...base, conversions: 100 })).toThrow("Conversions cannot exceed clicks");
  });

  it("throws on negative revenue", () => {
    expect(() => new BannerAnalytics({ ...base, revenue: -1 })).toThrow("Revenue cannot be negative");
  });

  it("ctr — 4.50 for 45/1000", () => {
    expect(new BannerAnalytics(base).ctr()).toBe(4.5);
  });

  it("ctr — 0 when no views", () => {
    const a = new BannerAnalytics({ ...base, views: 0, clicks: 0, conversions: 0 });
    expect(a.ctr()).toBe(0);
  });

  it("conversionRate — 20 for 9/45", () => {
    expect(new BannerAnalytics(base).conversionRate()).toBe(20);
  });

  it("conversionRate — 0 when no clicks", () => {
    const a = new BannerAnalytics({ ...base, clicks: 0, conversions: 0, revenue: 0 });
    expect(a.conversionRate()).toBe(0);
  });

  it("revenuePerClick — 10 for 450/45", () => {
    expect(new BannerAnalytics(base).revenuePerClick()).toBe(10);
  });

  it("revenuePerView — 0.45 for 450/1000", () => {
    expect(new BannerAnalytics(base).revenuePerView()).toBe(0.45);
  });

  it("topDevice — desktop when 500 > tablet(200) > mobile(300)", () => {
    expect(new BannerAnalytics(base).topDevice()).toBe("desktop");
  });

  it("topDevice — mobile when mobile highest", () => {
    const a = new BannerAnalytics({ ...base, deviceBreakdown: { desktop: 100, tablet: 50, mobile: 850 } });
    expect(a.topDevice()).toBe("mobile");
  });

  it("totalDeviceViews — 1000 for 500+200+300", () => {
    expect(new BannerAnalytics(base).totalDeviceViews()).toBe(1000);
  });

  it("devicePercent — 50% for desktop", () => {
    expect(new BannerAnalytics(base).devicePercent("desktop")).toBe(50);
  });

  it("devicePercent — 0 when no device data", () => {
    const a = new BannerAnalytics({ ...base, deviceBreakdown: { desktop: 0, tablet: 0, mobile: 0 } });
    expect(a.devicePercent("desktop")).toBe(0);
  });

  it("isHighPerforming — true above threshold", () => {
    expect(new BannerAnalytics(base).isHighPerforming(2.0)).toBe(true);
  });

  it("isHighPerforming — false with low views", () => {
    const a = new BannerAnalytics({ ...base, views: 50, clicks: 10, conversions: 2 });
    expect(a.isHighPerforming(2.0)).toBe(false);
  });

  it("aggregate — sums metrics across records", () => {
    const r1 = new BannerAnalytics({ ...base, id: "a1", views: 600, clicks: 20, conversions: 4, revenue: 200, deviceBreakdown: { desktop: 300, tablet: 100, mobile: 200 } });
    const r2 = new BannerAnalytics({ ...base, id: "a2", views: 400, clicks: 25, conversions: 5, revenue: 250, deviceBreakdown: { desktop: 200, tablet: 100, mobile: 100 } });
    const agg = BannerAnalytics.aggregate([r1, r2]);
    expect(agg.views).toBe(1000);
    expect(agg.clicks).toBe(45);
    expect(agg.revenue).toBe(450);
    expect(agg.deviceBreakdown.desktop).toBe(500);
    expect(agg.count).toBe(2);
  });

  it("aggregate — throws on empty array", () => {
    expect(() => BannerAnalytics.aggregate([])).toThrow("Cannot aggregate empty records");
  });

  it("defensive copy — topCountries cannot be mutated externally", () => {
    const a = new BannerAnalytics(base);
    a.topCountries.push({ code: "IN", name: "India", views: 100, clicks: 5 });
    expect(a.topCountries).toHaveLength(2);
  });
});
