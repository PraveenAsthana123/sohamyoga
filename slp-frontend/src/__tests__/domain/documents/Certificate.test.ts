import { Certificate, generateCertSerial } from "@/domain/documents/Certificate";

const base = {
  id: "cert1",
  type: "completion_certificate" as const,
  title: "Hatha Fundamentals — Completion Certificate",
  recipientId: "s1",
  recipientName: "Priya Mehta",
  recipientType: "student" as const,
  issuedBy: "admin1",
  issuedAt: new Date("2026-06-30"),
  status: "issued" as const,
  paperlessTagIds: [],
  courseId: "hatha-fundamentals",
  courseName: "Hatha Fundamentals",
  hoursCompleted: 50,
  notes: "",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Certificate", () => {
  it("creates valid certificate", () => {
    const c = new Certificate(base);
    expect(c.title).toBe("Hatha Fundamentals — Completion Certificate");
    expect(c.status).toBe("issued");
  });

  it("throws on blank title", () => {
    expect(() => new Certificate({ ...base, title: " " })).toThrow("Certificate title required");
  });

  it("throws on blank recipient name", () => {
    expect(() => new Certificate({ ...base, recipientName: "" })).toThrow("Recipient name required");
  });

  it("throws when expiry <= issued", () => {
    expect(() => new Certificate({ ...base, expiresAt: base.issuedAt })).toThrow("Expiry must be after issue date");
  });

  it("isExpired — false when no expiry set", () => {
    expect(new Certificate(base).isExpired()).toBe(false);
  });

  it("isExpired — true when expiry in past", () => {
    const c = new Certificate({ ...base, issuedAt: new Date("2019-01-01"), expiresAt: new Date("2020-01-01") });
    expect(c.isExpired()).toBe(true);
  });

  it("isExpired — false for future expiry", () => {
    const c = new Certificate({ ...base, expiresAt: new Date("2030-01-01") });
    expect(c.isExpired()).toBe(false);
  });

  it("isValid — true for issued status", () => {
    expect(new Certificate(base).isValid()).toBe(true);
  });

  it("isValid — false for revoked", () => {
    const c = new Certificate({ ...base, status: "revoked" });
    expect(c.isValid()).toBe(false);
  });

  it("daysUntilExpiry — null when no expiry", () => {
    expect(new Certificate(base).daysUntilExpiry()).toBeNull();
  });

  it("expiresWithinDays — true when expiring within window", () => {
    const soon = new Date(Date.now() + 7 * 86400000);
    const c = new Certificate({ ...base, expiresAt: soon });
    expect(c.expiresWithinDays(30)).toBe(true);
  });

  // --- State transitions ---
  it("issue — draft → issued", () => {
    const c = new Certificate({ ...base, status: "draft" }).issue();
    expect(c.status).toBe("issued");
  });

  it("issue — throws if not draft", () => {
    expect(() => new Certificate(base).issue()).toThrow("Only draft certificates can be issued");
  });

  it("sign — issued → signed", () => {
    const c = new Certificate(base).sign(new Date());
    expect(c.status).toBe("signed");
  });

  it("sign — throws if not issued", () => {
    expect(() => new Certificate({ ...base, status: "draft" }).sign(new Date())).toThrow("Only issued certificates can be signed");
  });

  it("revoke — requires reason", () => {
    expect(() => new Certificate(base).revoke("  ")).toThrow("Revocation reason required");
  });

  it("revoke — issued → revoked", () => {
    const c = new Certificate(base).revoke("Certificate issued in error");
    expect(c.status).toBe("revoked");
    expect(c.isValid()).toBe(false);
  });

  it("revoke — throws if already revoked", () => {
    const c = new Certificate({ ...base, status: "revoked" });
    expect(() => c.revoke("again")).toThrow("Already revoked");
  });

  it("archive — changes status", () => {
    const c = new Certificate(base).archive();
    expect(c.status).toBe("archived");
  });

  it("linkPaperless — stores document ID and tags", () => {
    const c = new Certificate(base).linkPaperless(42, [1, 5]);
    expect(c.paperlessDocumentId).toBe(42);
  });

  it("immutable — revoke does not modify original", () => {
    const c = new Certificate(base);
    c.revoke("reason");
    expect(c.status).toBe("issued");
  });
});

describe("generateCertSerial", () => {
  it("formats correctly", () => {
    expect(generateCertSerial(2026, 1)).toBe("SY-CERT-2026-0001");
  });

  it("pads sequence to 4 digits", () => {
    expect(generateCertSerial(2026, 42)).toBe("SY-CERT-2026-0042");
  });
});
