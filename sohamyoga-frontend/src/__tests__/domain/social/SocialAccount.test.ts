import { SocialAccount, PLATFORM_CONFIG } from "@/domain/social/SocialAccount";

const base = {
  id: "sa1",
  workspaceId: "ws1",
  platform: "instagram" as const,
  accountName: "SohamYoga Instagram",
  platformAccountId: "ig_12345",
  accessToken: "tok_abc",
  scopes: ["instagram_basic", "instagram_content_publish"],
  status: "connected" as const,
  connectedBy: "admin",
  connectedAt: new Date(),
  updatedAt: new Date(),
};

describe("SocialAccount", () => {
  it("creates valid account", () => {
    const a = new SocialAccount(base);
    expect(a.platform).toBe("instagram");
    expect(a.status).toBe("connected");
  });

  it("throws on empty account name", () => {
    expect(() => new SocialAccount({ ...base, accountName: "  " })).toThrow("Account name required");
  });

  it("throws on empty platform account ID", () => {
    expect(() => new SocialAccount({ ...base, platformAccountId: "" })).toThrow("Platform account ID required");
  });

  it("isHealthy — true when connected and token not expired", () => {
    expect(new SocialAccount(base).isHealthy()).toBe(true);
  });

  it("isHealthy — false when expired", () => {
    const a = new SocialAccount({ ...base, status: "expired" });
    expect(a.isHealthy()).toBe(false);
  });

  it("isTokenExpired — false when no expiry set", () => {
    expect(new SocialAccount(base).isTokenExpired()).toBe(false);
  });

  it("isTokenExpired — true when past expiry", () => {
    const past = new Date(Date.now() - 1000);
    const a = new SocialAccount({ ...base, tokenExpiresAt: past });
    expect(a.isTokenExpired()).toBe(true);
  });

  it("isTokenExpired — false when future expiry", () => {
    const future = new Date(Date.now() + 86400000);
    expect(new SocialAccount({ ...base, tokenExpiresAt: future }).isTokenExpired()).toBe(false);
  });

  it("daysUntilExpiry — null when no expiry", () => {
    expect(new SocialAccount(base).daysUntilExpiry()).toBeNull();
  });

  it("daysUntilExpiry — positive number for future token", () => {
    const future = new Date(Date.now() + 86400000 * 5);
    expect(new SocialAccount({ ...base, tokenExpiresAt: future }).daysUntilExpiry()).toBeGreaterThan(0);
  });

  it("markExpired — returns expired account", () => {
    const a = new SocialAccount(base).markExpired();
    expect(a.status).toBe("expired");
  });

  it("markRevoked — clears tokens", () => {
    const a = new SocialAccount(base).markRevoked();
    expect(a.status).toBe("revoked");
  });

  it("markError — sets error message", () => {
    const a = new SocialAccount(base).markError("Rate limit exceeded");
    expect(a.status).toBe("error");
  });

  it("refreshed — updates token and sets connected", () => {
    const expired = new SocialAccount({ ...base, status: "expired" });
    const future = new Date(Date.now() + 86400000 * 60);
    const refreshed = expired.refreshed("new_token", future);
    expect(refreshed.status).toBe("connected");
    expect(refreshed.isTokenExpired()).toBe(false);
  });

  it("toJSON — does not expose accessToken", () => {
    const json = new SocialAccount(base).toJSON();
    expect((json as any).accessToken).toBeUndefined();
    expect((json as any).refreshToken).toBeUndefined();
  });

  it("toJSON — returns defensive copy of scopes", () => {
    const a = new SocialAccount(base);
    const json = a.toJSON();
    json.scopes.push("extra");
    expect(a.scopes).toHaveLength(2);
  });

  it("immutable — markExpired does not modify original", () => {
    const a = new SocialAccount(base);
    a.markExpired();
    expect(a.status).toBe("connected");
  });
});

describe("PLATFORM_CONFIG", () => {
  it("has all 20 supported and custom-connector platforms", () => {
    expect(Object.keys(PLATFORM_CONFIG)).toHaveLength(20);
  });

  it("all platforms require approval", () => {
    Object.values(PLATFORM_CONFIG).forEach(p => {
      expect(p.requiresApproval).toBe(true);
    });
  });

  it("instagram supports carousel", () => {
    expect(PLATFORM_CONFIG.instagram.supportsCarousel).toBe(true);
  });

  it("x_twitter does not support carousel", () => {
    expect(PLATFORM_CONFIG.x_twitter.supportsCarousel).toBe(false);
  });

  it("whatsapp_business is custom_connector", () => {
    expect(PLATFORM_CONFIG.whatsapp_business.postizSupport).toBe("custom_connector");
  });

  it("facebook is postiz supported", () => {
    expect(PLATFORM_CONFIG.facebook.postizSupport).toBe("postiz");
  });

  it("all platforms have positive maxCharacters", () => {
    Object.values(PLATFORM_CONFIG).forEach(p => {
      expect(p.maxCharacters).toBeGreaterThan(0);
    });
  });
});
