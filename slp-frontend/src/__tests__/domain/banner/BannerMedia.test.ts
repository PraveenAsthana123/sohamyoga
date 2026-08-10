import { BannerMedia, SOCIAL_VARIANTS } from "@/domain/banner/BannerMedia";

const CREATED_AT = new Date("2026-01-01");

const base = {
  id: "m1",
  fileName: "summer-retreat-hero.jpg",
  originalName: "Summer Retreat Hero.jpg",
  mimeType: "image/jpeg",
  assetType: "image" as const,
  fileSize: 512000,   // 500 KB
  width: 1920,
  height: 1080,
  url: "https://cdn.sohamyoga.com/assets/m1.jpg",
  altText: "Morning sun salutation on beach",
  status: "ready" as const,
  tags: ["summer", "hero"],
  socialVariants: [],
  uploadedBy: "admin1",
  createdAt: CREATED_AT,
  updatedAt: new Date(),
};

describe("BannerMedia", () => {
  it("creates valid media asset", () => {
    const m = new BannerMedia(base);
    expect(m.fileName).toBe("summer-retreat-hero.jpg");
    expect(m.assetType).toBe("image");
  });

  it("throws on blank file name", () => {
    expect(() => new BannerMedia({ ...base, fileName: " " })).toThrow("File name required");
  });

  it("throws on blank URL", () => {
    expect(() => new BannerMedia({ ...base, url: "" })).toThrow("URL required");
  });

  it("throws on blank alt text", () => {
    expect(() => new BannerMedia({ ...base, altText: "  " })).toThrow("Alt text required for accessibility");
  });

  it("throws on negative file size", () => {
    expect(() => new BannerMedia({ ...base, fileSize: -1 })).toThrow("File size cannot be negative");
  });

  it("throws on zero width", () => {
    expect(() => new BannerMedia({ ...base, width: 0 })).toThrow("Width must be positive");
  });

  it("throws on zero height", () => {
    expect(() => new BannerMedia({ ...base, height: 0 })).toThrow("Height must be positive");
  });

  it("throws when expiry <= createdAt", () => {
    expect(() => new BannerMedia({ ...base, expiresAt: CREATED_AT })).toThrow("Expiry must be after upload date");
  });

  it("isReady — true for ready status", () => {
    expect(new BannerMedia(base).isReady()).toBe(true);
  });

  it("isReady — false for processing", () => {
    expect(new BannerMedia({ ...base, status: "processing" }).isReady()).toBe(false);
  });

  it("isExpired — false with no expiry", () => {
    expect(new BannerMedia(base).isExpired()).toBe(false);
  });

  it("isExpired — true with past expiry", () => {
    const old = new BannerMedia({ ...base, createdAt: new Date("2020-01-01"), expiresAt: new Date("2021-01-01") });
    expect(old.isExpired()).toBe(true);
  });

  it("fileSizeMB — 0.49 for 512000 bytes", () => {
    expect(new BannerMedia(base).fileSizeMB()).toBe(0.49);
  });

  it("aspectRatio — 16:9 for 1920x1080", () => {
    expect(new BannerMedia(base).aspectRatio()).toBe("16:9");
  });

  it("aspectRatio — 1:1 for 1080x1080", () => {
    const m = new BannerMedia({ ...base, width: 1080, height: 1080 });
    expect(m.aspectRatio()).toBe("1:1");
  });

  it("aspectRatio — null when dimensions missing", () => {
    const m = new BannerMedia({ ...base, width: undefined, height: undefined });
    expect(m.aspectRatio()).toBeNull();
  });

  it("hasVariantFor — false initially", () => {
    expect(new BannerMedia(base).hasVariantFor("instagram_square")).toBe(false);
  });

  it("addSocialVariant — stores variant URL", () => {
    const m = new BannerMedia(base).addSocialVariant({ platform: "instagram_square", width: 1080, height: 1080, url: "https://cdn.sohamyoga.com/m1-ig.jpg" });
    expect(m.hasVariantFor("instagram_square")).toBe(true);
  });

  it("addSocialVariant — replaces existing same platform", () => {
    const m = new BannerMedia(base)
      .addSocialVariant({ platform: "instagram_square", width: 1080, height: 1080, url: "v1.jpg" })
      .addSocialVariant({ platform: "instagram_square", width: 1080, height: 1080, url: "v2.jpg" });
    const variants = m.socialVariants.filter(v => v.platform === "instagram_square");
    expect(variants).toHaveLength(1);
    expect(variants[0].url).toBe("v2.jpg");
  });

  it("markReady — updates status", () => {
    const m = new BannerMedia({ ...base, status: "processing" }).markReady();
    expect(m.status).toBe("ready");
  });

  it("markError — updates status", () => {
    const m = new BannerMedia({ ...base, status: "uploading" }).markError();
    expect(m.status).toBe("error");
  });

  it("archive — throws if already archived", () => {
    expect(() => new BannerMedia({ ...base, status: "archived" }).archive()).toThrow("Already archived");
  });

  it("addTag — appends", () => {
    expect(new BannerMedia(base).addTag("hero").tags).toContain("hero");
  });

  it("linkPhotoprism — stores ID", () => {
    expect(new BannerMedia(base).linkPhotoprism("pp_abc").photoprismId).toBe("pp_abc");
  });

  it("SOCIAL_VARIANTS — 8 platform variants defined", () => {
    expect(SOCIAL_VARIANTS).toHaveLength(8);
  });

  it("SOCIAL_VARIANTS — includes instagram_story (1080x1920)", () => {
    const story = SOCIAL_VARIANTS.find(v => v.platform === "instagram_story");
    expect(story?.width).toBe(1080);
    expect(story?.height).toBe(1920);
  });

  it("immutable — addTag does not modify original", () => {
    const m = new BannerMedia(base);
    m.addTag("festival");
    expect(m.tags).not.toContain("festival");
  });
});
