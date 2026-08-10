import { CampaignMetrics, LeadScore } from "@/domain/campaign/CampaignMetrics";

const baseMetrics = {
  campaignId: "camp_1",
  audienceSize: 500,
  channelMetrics: [
    { channel: "email",    sent: 400, delivered: 380, opened: 190, clicked: 76, converted: 30, unsubscribed: 4, bounced: 20 },
    { channel: "whatsapp", sent: 300, delivered: 295, opened: 250, clicked: 120, converted: 20, unsubscribed: 2, bounced: 5 },
  ],
  conversions: 50,
  revenueCAD: 2450,
  costCAD: 200,
  goalTarget: 50,
  computedAt: new Date(),
};

describe("CampaignMetrics", () => {
  const m = new CampaignMetrics(baseMetrics);

  it("totals sent across channels", () => {
    expect(m.totalSent()).toBe(700);
  });

  it("totals delivered across channels", () => {
    expect(m.totalDelivered()).toBe(675);
  });

  it("totals opened across channels", () => {
    expect(m.totalOpened()).toBe(440);
  });

  it("calculates delivery rate", () => {
    expect(m.deliveryRate()).toBeCloseTo(675 / 700, 3);
  });

  it("calculates open rate from delivered", () => {
    expect(m.openRate()).toBeCloseTo(440 / 675, 3);
  });

  it("calculates conversion rate from sent", () => {
    expect(m.conversionRate()).toBeCloseTo(50 / 700, 3);
  });

  it("calculates ROI", () => {
    expect(m.roi()).toBeCloseTo((2450 - 200) / 200, 3); // 11.25
  });

  it("calculates ROI percent", () => {
    expect(m.roiPercent()).toBeCloseTo(1125, 0);
  });

  it("returns Infinity ROI when cost is 0 and revenue > 0", () => {
    const m2 = new CampaignMetrics({ ...baseMetrics, costCAD: 0, revenueCAD: 500 });
    expect(m2.roi()).toBe(Infinity);
  });

  it("calculates goal progress", () => {
    expect(m.goalProgressPercent()).toBe(100);
    expect(m.isGoalMet()).toBe(true);
  });

  it("caps goal progress at 100", () => {
    const m2 = new CampaignMetrics({ ...baseMetrics, conversions: 200, goalTarget: 50 });
    expect(m2.goalProgressPercent()).toBe(100);
  });

  it("retrieves metrics for specific channel", () => {
    const emailMetrics = m.metricsForChannel("email");
    expect(emailMetrics?.sent).toBe(400);
    expect(emailMetrics?.converted).toBe(30);
  });
});

describe("LeadScore", () => {
  it("computes hot tier for score >= 75", () => {
    expect(LeadScore.computeTier(80)).toBe("hot");
    expect(LeadScore.computeTier(75)).toBe("hot");
  });

  it("computes warm tier for 50-74", () => {
    expect(LeadScore.computeTier(60)).toBe("warm");
  });

  it("computes cold tier for < 50", () => {
    expect(LeadScore.computeTier(30)).toBe("cold");
    expect(LeadScore.computeTier(10)).toBe("cold");
  });

  it("throws on score out of range", () => {
    expect(() => new LeadScore({ userId: "u1", score: 101, signals: [], tier: "cold", computedAt: new Date() }))
      .toThrow("Score must be 0–100");
  });

  it("hot lead is ready to convert", () => {
    const ls = new LeadScore({ userId: "u1", score: 80, signals: [], tier: "hot", computedAt: new Date() });
    expect(ls.isReadyToConvert()).toBe(true);
  });
});
