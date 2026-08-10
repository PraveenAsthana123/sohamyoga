import { CustomerProfile } from "@/domain/customer/CustomerProfile";

const base = {
  id: "c1",
  firstName: "Priya",
  lastName: "Mehta",
  email: "priya@example.com",
  type: "individual" as const,
  lifecycle: "active" as const,
  acquisitionSource: "referral" as const,
  currency: "CAD",
  lifetimeValue: 1200,
  totalInvoiced: 1400,
  totalPaid: 1200,
  outstandingBalance: 200,
  creditLimit: 500,
  loyaltyPoints: 1200,
  loyaltyTier: "silver" as const,
  totalSessions: 42,
  tags: [],
  segments: [],
  country: "Canada",
  notes: "",
  doNotContact: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("CustomerProfile", () => {
  it("creates valid profile", () => {
    const c = new CustomerProfile(base);
    expect(c.fullName).toBe("Priya Mehta");
    expect(c.lifecycle).toBe("active");
  });

  it("throws on blank first name", () => {
    expect(() => new CustomerProfile({ ...base, firstName: " " })).toThrow("First name required");
  });

  it("throws on invalid email", () => {
    expect(() => new CustomerProfile({ ...base, email: "notvalid" })).toThrow("Invalid email");
  });

  it("throws on negative lifetime value", () => {
    expect(() => new CustomerProfile({ ...base, lifetimeValue: -1 })).toThrow("Lifetime value cannot be negative");
  });

  it("throws on NPS out of range", () => {
    expect(() => new CustomerProfile({ ...base, npsScore: 150 })).toThrow("NPS score must be -100 to +100");
  });

  it("paymentRate — correct percentage", () => {
    expect(new CustomerProfile(base).paymentRate()).toBe(86); // 1200/1400
  });

  it("paymentRate — 0 when nothing invoiced", () => {
    const c = new CustomerProfile({ ...base, totalInvoiced: 0, totalPaid: 0 });
    expect(c.paymentRate()).toBe(0);
  });

  it("isVip — true when platinum tier", () => {
    const c = new CustomerProfile({ ...base, loyaltyTier: "platinum" });
    expect(c.isVip()).toBe(true);
  });

  it("isVip — true when ltv >= 5000", () => {
    const c = new CustomerProfile({ ...base, lifetimeValue: 5001 });
    expect(c.isVip()).toBe(true);
  });

  it("npsCategory — promoter for score >= 70", () => {
    const c = new CustomerProfile({ ...base, npsScore: 80 });
    expect(c.npsCategory()).toBe("promoter");
  });

  it("npsCategory — detractor for negative score", () => {
    const c = new CustomerProfile({ ...base, npsScore: -30 });
    expect(c.npsCategory()).toBe("detractor");
  });

  it("npsCategory — unknown when no score", () => {
    expect(new CustomerProfile(base).npsCategory()).toBe("unknown");
  });

  it("computedLoyaltyTier — gold for 5000 points", () => {
    const c = new CustomerProfile({ ...base, loyaltyPoints: 5000 });
    expect(c.computedLoyaltyTier()).toBe("gold");
  });

  it("computedLoyaltyTier — platinum for 10000 points", () => {
    const c = new CustomerProfile({ ...base, loyaltyPoints: 10000 });
    expect(c.computedLoyaltyTier()).toBe("platinum");
  });

  it("promote — changes lifecycle", () => {
    const c = new CustomerProfile(base).promote("vip");
    expect(c.lifecycle).toBe("vip");
  });

  it("addLoyaltyPoints — adds points", () => {
    const c = new CustomerProfile(base).addLoyaltyPoints(500);
    expect(c.loyaltyPoints).toBe(1700);
  });

  it("addLoyaltyPoints — throws on zero or negative", () => {
    expect(() => new CustomerProfile(base).addLoyaltyPoints(0)).toThrow("Points must be positive");
  });

  it("addTag — adds tag", () => {
    const c = new CustomerProfile(base).addTag("vip_event_invite");
    expect(c.tags).toContain("vip_event_invite");
  });

  it("addTag — idempotent", () => {
    const c = new CustomerProfile(base).addTag("t1").addTag("t1");
    expect(c.tags.filter(t => t === "t1")).toHaveLength(1);
  });

  it("removeTag — removes tag", () => {
    const c = new CustomerProfile({ ...base, tags: ["t1","t2"] }).removeTag("t1");
    expect(c.tags).not.toContain("t1");
    expect(c.tags).toContain("t2");
  });

  it("markDoNotContact — sets flag", () => {
    const c = new CustomerProfile(base).markDoNotContact();
    expect(c.doNotContact).toBe(true);
  });

  it("immutable — addTag does not modify original", () => {
    const c = new CustomerProfile(base);
    c.addTag("new");
    expect(c.tags).toHaveLength(0);
  });
});
