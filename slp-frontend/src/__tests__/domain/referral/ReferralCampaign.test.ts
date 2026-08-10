import { ReferralCampaign, ReferralCampaignProps } from "../../../domain/referral/ReferralCampaign";

const NOW    = new Date("2026-08-05");
const FUTURE = new Date("2027-01-01");
const PAST   = new Date("2025-01-01");
const START  = new Date("2026-07-01");
const END    = new Date("2026-12-31");

function base(overrides: Partial<ReferralCampaignProps> = {}): ReferralCampaignProps {
  return {
    id: "camp-1",
    name: "Summer Referral 2026",
    slug: "summer-referral-2026",
    type: "standard",
    status: "active",
    rewardType: "wallet_credit",
    referrerRewardValue: 25,
    referreeRewardValue: 15,
    eligibleReferralTypes: ["customer_customer"],
    requiresMembershipPurchase: true,
    startDate: START,
    endDate: END,
    totalReferrals: 0,
    totalRewardsPaid: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("ReferralCampaign — construction", () => {
  it("creates a valid campaign", () => {
    const c = new ReferralCampaign(base());
    expect(c.name).toBe("Summer Referral 2026");
    expect(c.status).toBe("active");
    expect(c.referrerRewardValue).toBe(25);
    expect(c.referreeRewardValue).toBe(15);
  });

  it("throws on empty id", () => {
    expect(() => new ReferralCampaign(base({ id: "" }))).toThrow("id is required");
  });

  it("throws on empty name", () => {
    expect(() => new ReferralCampaign(base({ name: "" }))).toThrow("name is required");
  });

  it("throws on empty slug", () => {
    expect(() => new ReferralCampaign(base({ slug: "" }))).toThrow("slug is required");
  });

  it("throws on invalid slug (uppercase)", () => {
    expect(() => new ReferralCampaign(base({ slug: "Summer-2026" }))).toThrow("lowercase kebab-case");
  });

  it("throws on invalid slug (spaces)", () => {
    expect(() => new ReferralCampaign(base({ slug: "summer 2026" }))).toThrow("lowercase kebab-case");
  });

  it("throws on negative referrerRewardValue", () => {
    expect(() => new ReferralCampaign(base({ referrerRewardValue: -1 }))).toThrow("referrerRewardValue must be >= 0");
  });

  it("throws on negative referreeRewardValue", () => {
    expect(() => new ReferralCampaign(base({ referreeRewardValue: -1 }))).toThrow("referreeRewardValue must be >= 0");
  });

  it("throws when both reward values are zero", () => {
    expect(() => new ReferralCampaign(base({ referrerRewardValue: 0, referreeRewardValue: 0 }))).toThrow("At least one reward value");
  });

  it("allows one-sided reward (referrer only)", () => {
    const c = new ReferralCampaign(base({ referrerRewardValue: 30, referreeRewardValue: 0 }));
    expect(c.referrerRewardValue).toBe(30);
    expect(c.referreeRewardValue).toBe(0);
  });

  it("throws on maxReferrals < 1", () => {
    expect(() => new ReferralCampaign(base({ maxReferrals: 0 }))).toThrow("maxReferrals must be >= 1");
  });

  it("throws on maxRewardPerReferrer < 1", () => {
    expect(() => new ReferralCampaign(base({ maxRewardPerReferrer: 0 }))).toThrow("maxRewardPerReferrer must be >= 1");
  });

  it("throws on empty eligibleReferralTypes", () => {
    expect(() => new ReferralCampaign(base({ eligibleReferralTypes: [] }))).toThrow("At least one eligible referral type");
  });

  it("throws on negative totalReferrals", () => {
    expect(() => new ReferralCampaign(base({ totalReferrals: -1 }))).toThrow("totalReferrals must be >= 0");
  });

  it("throws on endDate before startDate", () => {
    expect(() => new ReferralCampaign(base({ startDate: END, endDate: START }))).toThrow("endDate must be after startDate");
  });

  it("eligibleReferralTypes getter returns defensive copy", () => {
    const c = new ReferralCampaign(base());
    const types = c.eligibleReferralTypes;
    types.push("affiliate");
    expect(c.eligibleReferralTypes).toHaveLength(1);
  });
});

describe("ReferralCampaign — isActive", () => {
  it("active campaign within date range is active", () => {
    expect(new ReferralCampaign(base()).isActive(NOW)).toBe(true);
  });

  it("paused campaign is not active", () => {
    expect(new ReferralCampaign(base({ status: "paused" })).isActive(NOW)).toBe(false);
  });

  it("ended campaign is not active", () => {
    expect(new ReferralCampaign(base({ status: "ended" })).isActive(NOW)).toBe(false);
  });

  it("active campaign before startDate is not active", () => {
    const future = new Date("2027-01-01");
    expect(new ReferralCampaign(base({ startDate: future, endDate: new Date("2027-12-31") })).isActive(NOW)).toBe(false);
  });

  it("active campaign after endDate is not active", () => {
    const earlyEnd = new Date("2025-06-01");
    expect(new ReferralCampaign(base({ startDate: PAST, endDate: earlyEnd })).isActive(NOW)).toBe(false);
  });

  it("maxed out campaign is not active", () => {
    expect(new ReferralCampaign(base({ maxReferrals: 10, totalReferrals: 10 })).isActive(NOW)).toBe(false);
  });

  it("campaign with no endDate and no maxReferrals stays active", () => {
    const c = new ReferralCampaign(base({ endDate: undefined }));
    expect(c.isActive(NOW)).toBe(true);
  });
});

describe("ReferralCampaign — isEligibleType", () => {
  it("returns true for listed type", () => {
    const c = new ReferralCampaign(base({ eligibleReferralTypes: ["teacher_student", "partner"] }));
    expect(c.isEligibleType("teacher_student")).toBe(true);
  });

  it("returns false for unlisted type", () => {
    const c = new ReferralCampaign(base());
    expect(c.isEligibleType("corporate")).toBe(false);
  });
});

describe("ReferralCampaign — status transitions", () => {
  it("draft → active", () => {
    const c = new ReferralCampaign(base({ status: "draft" })).activate();
    expect(c.status).toBe("active");
  });

  it("paused → active", () => {
    const c = new ReferralCampaign(base({ status: "paused" })).activate();
    expect(c.status).toBe("active");
  });

  it("activate throws when already active", () => {
    expect(() => new ReferralCampaign(base()).activate()).toThrow("already active");
  });

  it("activate throws when ended", () => {
    expect(() => new ReferralCampaign(base({ status: "ended" })).activate()).toThrow("Ended campaigns");
  });

  it("active → paused", () => {
    const c = new ReferralCampaign(base()).pause();
    expect(c.status).toBe("paused");
  });

  it("pause throws when not active", () => {
    expect(() => new ReferralCampaign(base({ status: "draft" })).pause()).toThrow("Only active campaigns");
  });

  it("active → ended", () => {
    const c = new ReferralCampaign(base()).end();
    expect(c.status).toBe("ended");
  });

  it("end throws when already ended", () => {
    expect(() => new ReferralCampaign(base({ status: "ended" })).end()).toThrow("already ended");
  });

  it("transitions are immutable", () => {
    const original = new ReferralCampaign(base());
    original.pause();
    expect(original.status).toBe("active");
  });
});

describe("ReferralCampaign — recordReferral", () => {
  it("increments totalReferrals and totalRewardsPaid", () => {
    const c = new ReferralCampaign(base()).recordReferral(40);
    expect(c.totalReferrals).toBe(1);
    expect(c.totalRewardsPaid).toBe(40);
  });

  it("accumulates multiple referrals", () => {
    const c = new ReferralCampaign(base())
      .recordReferral(25)
      .recordReferral(25)
      .recordReferral(15);
    expect(c.totalReferrals).toBe(3);
    expect(c.totalRewardsPaid).toBe(65);
  });

  it("rounds totalRewardsPaid to 2 dp", () => {
    const c = new ReferralCampaign(base()).recordReferral(10.555);
    expect(c.totalRewardsPaid).toBe(10.56);
  });

  it("throws when campaign is not active", () => {
    expect(() => new ReferralCampaign(base({ status: "paused" })).recordReferral(25)).toThrow("not active");
  });

  it("throws on negative rewardAmount", () => {
    expect(() => new ReferralCampaign(base()).recordReferral(-1)).toThrow("rewardAmount must be >= 0");
  });

  it("allows zero rewardAmount (free service reward)", () => {
    const c = new ReferralCampaign(base()).recordReferral(0);
    expect(c.totalReferrals).toBe(1);
    expect(c.totalRewardsPaid).toBe(0);
  });
});

describe("ReferralCampaign — eligible type management", () => {
  it("addEligibleType adds a new type", () => {
    const c = new ReferralCampaign(base()).addEligibleType("corporate");
    expect(c.eligibleReferralTypes).toContain("corporate");
  });

  it("addEligibleType is idempotent", () => {
    const c = new ReferralCampaign(base())
      .addEligibleType("customer_customer")
      .addEligibleType("customer_customer");
    expect(c.eligibleReferralTypes.filter(t => t === "customer_customer")).toHaveLength(1);
  });

  it("removeEligibleType removes a type", () => {
    const c = new ReferralCampaign(
      base({ eligibleReferralTypes: ["customer_customer", "affiliate"] })
    ).removeEligibleType("affiliate");
    expect(c.eligibleReferralTypes).not.toContain("affiliate");
  });

  it("removeEligibleType throws when removing last type", () => {
    expect(() => new ReferralCampaign(base()).removeEligibleType("customer_customer")).toThrow("last eligible");
  });
});
