import { FeatureFlag, DEFAULT_FEATURE_FLAGS } from "@/domain/features/FeatureFlag";

const base = {
  key: "booking.class_catalog",
  name: "Class Catalog",
  description: "Browse classes",
  category: "booking" as const,
  scope: "all" as const,
  enabled: true,
  rolloutPercent: 100,
  allowedRoles: [],
  metadata: {},
  updatedBy: "admin",
  updatedAt: new Date(),
};

describe("FeatureFlag", () => {
  it("creates valid flag", () => {
    const f = new FeatureFlag(base);
    expect(f.key).toBe("booking.class_catalog");
    expect(f.enabled).toBe(true);
  });

  it("throws on invalid key format", () => {
    expect(() => new FeatureFlag({ ...base, key: "Booking.Catalog" }))
      .toThrow("Feature key must be lowercase");
  });

  it("throws on rollout > 100", () => {
    expect(() => new FeatureFlag({ ...base, rolloutPercent: 101 }))
      .toThrow("Rollout percent must be 0–100");
  });

  it("throws on negative rollout", () => {
    expect(() => new FeatureFlag({ ...base, rolloutPercent: -1 }))
      .toThrow("Rollout percent must be 0–100");
  });

  it("isEnabledFor — false when disabled", () => {
    const f = new FeatureFlag({ ...base, enabled: false });
    expect(f.isEnabledFor("student")).toBe(false);
  });

  it("isEnabledFor — true when enabled and 100% rollout", () => {
    expect(new FeatureFlag(base).isEnabledFor("student")).toBe(true);
  });

  it("isEnabledFor — false when role not in allowedRoles", () => {
    const f = new FeatureFlag({ ...base, allowedRoles: ["admin"] });
    expect(f.isEnabledFor("student")).toBe(false);
  });

  it("isEnabledFor — true when role in allowedRoles", () => {
    const f = new FeatureFlag({ ...base, allowedRoles: ["admin"] });
    expect(f.isEnabledFor("admin")).toBe(true);
  });

  it("isEnabledFor — uses hash for partial rollout", () => {
    const f = new FeatureFlag({ ...base, rolloutPercent: 50 });
    // userId hash 30 → 30 < 50 → enabled
    expect(f.isEnabledFor("student", 30)).toBe(true);
    // userId hash 80 → 80 >= 50 → disabled
    expect(f.isEnabledFor("student", 80)).toBe(false);
  });

  it("enable — returns new enabled flag", () => {
    const f = new FeatureFlag({ ...base, enabled: false }).enable("admin");
    expect(f.enabled).toBe(true);
  });

  it("disable — returns new disabled flag", () => {
    const f = new FeatureFlag(base).disable("admin");
    expect(f.enabled).toBe(false);
  });

  it("setRollout — updates rollout percent", () => {
    const f = new FeatureFlag(base).setRollout(25, "admin");
    expect(f.rolloutPercent).toBe(25);
  });

  it("setRollout — throws on invalid percent", () => {
    expect(() => new FeatureFlag(base).setRollout(150, "admin")).toThrow("Rollout percent must be 0–100");
  });

  it("immutable — enable does not mutate original", () => {
    const f = new FeatureFlag({ ...base, enabled: false });
    f.enable("admin");
    expect(f.enabled).toBe(false);
  });
});

describe("DEFAULT_FEATURE_FLAGS", () => {
  it("has at least 30 flags", () => {
    expect(DEFAULT_FEATURE_FLAGS.length).toBeGreaterThanOrEqual(30);
  });

  it("all keys are lowercase with dots", () => {
    DEFAULT_FEATURE_FLAGS.forEach(f => {
      expect(f.key).toMatch(/^[a-z][a-z0-9_.]+$/);
    });
  });

  it("all keys are unique", () => {
    const keys = DEFAULT_FEATURE_FLAGS.map(f => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ai.pose_detection starts disabled", () => {
    const flag = DEFAULT_FEATURE_FLAGS.find(f => f.key === "ai.pose_detection");
    expect(flag?.enabled).toBe(false);
  });

  it("booking.class_catalog starts enabled", () => {
    const flag = DEFAULT_FEATURE_FLAGS.find(f => f.key === "booking.class_catalog");
    expect(flag?.enabled).toBe(true);
  });
});
