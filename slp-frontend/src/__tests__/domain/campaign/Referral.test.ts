import { Referral } from "@/domain/campaign/Referral";

const base = {
  id: "ref_1",
  referrerId: "user_1",
  refereeEmail: "friend@example.com",
  referralCode: "AISHA2026",
  status: "PENDING" as const,
  referrerReward: "1 free class",
  refereeReward: "14-day free trial",
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 30 * 86400000),
};

describe("Referral", () => {
  it("creates a valid referral", () => {
    const r = new Referral(base);
    expect(r.status).toBe("PENDING");
    expect(r.isActive()).toBe(true);
  });

  it("throws on invalid email", () => {
    expect(() => new Referral({ ...base, refereeEmail: "not-email" })).toThrow("Invalid referee email");
  });

  it("throws when code is blank", () => {
    expect(() => new Referral({ ...base, referralCode: "" })).toThrow("Referral code is required");
  });

  it("marks as SIGNED_UP when link used", () => {
    const r = new Referral(base).linkUsed("user_2");
    expect(r.status).toBe("SIGNED_UP");
  });

  it("throws when self-referral attempted", () => {
    const r = new Referral(base);
    expect(() => r.linkUsed("user_1")).toThrow("Cannot refer yourself");
  });

  it("converts a SIGNED_UP referral", () => {
    const r = new Referral(base).linkUsed("user_2").convert();
    expect(r.status).toBe("CONVERTED");
    expect(r.domainEvents[0].type).toBe("ReferralConverted");
  });

  it("throws when converting before sign up", () => {
    const r = new Referral(base);
    expect(() => r.convert()).toThrow("Referee must have signed up first");
  });

  it("rewards a converted referral", () => {
    const r = new Referral(base).linkUsed("user_2").convert().reward();
    expect(r.status).toBe("REWARDED");
  });

  it("expires a PENDING referral", () => {
    const r = new Referral(base).expire();
    expect(r.status).toBe("EXPIRED");
  });

  it("detects expired referral", () => {
    const r = new Referral({ ...base, expiresAt: new Date("2020-01-01"), createdAt: new Date("2019-01-01") });
    expect(r.isExpired()).toBe(true);
    expect(r.isActive()).toBe(false);
  });

  it("generates correct share link", () => {
    const r = new Referral(base);
    expect(r.shareLink("https://sohamyoga.com")).toBe("https://sohamyoga.com/join?ref=AISHA2026");
  });
});
