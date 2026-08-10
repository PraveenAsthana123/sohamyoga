import { Campaign } from "@/domain/campaign/Campaign";

const base = {
  id: "camp_1",
  name: "August Membership Push",
  description: "Drive free users to monthly plan",
  type: "one_time" as const,
  channels: ["email", "whatsapp"] as const,
  audienceSegmentId: "seg_free",
  contentVariantIds: ["cv_1"],
  goalType: "membership_conversions" as const,
  goalTarget: 50,
  createdById: "admin_1",
};

describe("Campaign", () => {
  it("creates in DRAFT state with CampaignCreated event", () => {
    const c = Campaign.create(base);
    expect(c.status).toBe("DRAFT");
    expect(c.isDraft()).toBe(true);
    expect(c.domainEvents[0].type).toBe("CampaignCreated");
  });

  it("throws when name is blank", () => {
    expect(() => Campaign.create({ ...base, name: "" })).toThrow("Campaign name is required");
  });

  it("throws when no channels provided", () => {
    expect(() => Campaign.create({ ...base, channels: [] })).toThrow("At least one channel required");
  });

  it("throws when goal target < 1", () => {
    expect(() => Campaign.create({ ...base, goalTarget: 0 })).toThrow("Goal target must be >= 1");
  });

  it("throws when A/B test has fewer than 2 variants", () => {
    expect(() => Campaign.create({ ...base, type: "ab_test", contentVariantIds: ["cv_1"] }))
      .toThrow("A/B test campaigns require at least 2 content variants");
  });

  it("schedules a DRAFT campaign", () => {
    const future = new Date(Date.now() + 86400000);
    const c = Campaign.create(base).schedule(future);
    expect(c.status).toBe("SCHEDULED");
    expect(c.scheduledAt?.getTime()).toBeCloseTo(future.getTime(), -2);
  });

  it("throws when scheduling in the past", () => {
    const past = new Date("2020-01-01");
    const c = Campaign.create(base);
    expect(() => c.schedule(past)).toThrow("Scheduled time must be in the future");
  });

  it("launches a DRAFT campaign", () => {
    const c = Campaign.create(base).launch();
    expect(c.status).toBe("RUNNING");
    expect(c.isRunning()).toBe(true);
    expect(c.domainEvents.some(e => e.type === "CampaignLaunched")).toBe(true);
  });

  it("launches a SCHEDULED campaign", () => {
    const future = new Date(Date.now() + 86400000);
    const c = Campaign.create(base).schedule(future).launch();
    expect(c.status).toBe("RUNNING");
  });

  it("pauses a RUNNING campaign", () => {
    const c = Campaign.create(base).launch().pause();
    expect(c.status).toBe("PAUSED");
  });

  it("resumes a PAUSED campaign", () => {
    const c = Campaign.create(base).launch().pause().resume();
    expect(c.status).toBe("RUNNING");
  });

  it("completes a RUNNING campaign", () => {
    const c = Campaign.create(base).launch().complete();
    expect(c.status).toBe("COMPLETED");
  });

  it("cancels a DRAFT campaign", () => {
    const c = Campaign.create(base).cancel();
    expect(c.status).toBe("CANCELLED");
  });

  it("throws when cancelling a COMPLETED campaign", () => {
    const c = Campaign.create(base).launch().complete();
    expect(() => c.cancel()).toThrow("Cannot cancel a completed campaign");
  });

  it("identifies A/B test campaign", () => {
    const ab = Campaign.create({ ...base, type: "ab_test", contentVariantIds: ["cv_1", "cv_2"] });
    expect(ab.isABTest()).toBe(true);
  });
});
