import { User, EmailAlreadyVerifiedError, UserInactiveError } from "@/domain/identity/User";

const base = {
  id: "user_1",
  email: "aisha@example.com",
  name: "Aisha Patel",
  role: "student" as const,
  timezone: "America/Vancouver",
  preferredLanguage: "en",
  emailVerified: false,
  phoneVerified: false,
  isActive: true,
  createdAt: new Date("2026-01-01"),
};

describe("User", () => {
  it("creates a valid user", () => {
    const u = new User(base);
    expect(u.email).toBe("aisha@example.com");
    expect(u.isStudent()).toBe(true);
    expect(u.isTeacher()).toBe(false);
    expect(u.isAdmin()).toBe(false);
  });

  it("throws on invalid email", () => {
    expect(() => new User({ ...base, email: "not-an-email" })).toThrow("Invalid email address");
  });

  it("throws when name is blank", () => {
    expect(() => new User({ ...base, name: "   " })).toThrow("Name is required");
  });

  it("verifies email once", () => {
    const u = new User(base).verifyEmail();
    expect(u.emailVerified).toBe(true);
  });

  it("throws when email already verified", () => {
    const u = new User({ ...base, emailVerified: true });
    expect(() => u.verifyEmail()).toThrow(EmailAlreadyVerifiedError);
  });

  it("deactivates user immutably", () => {
    const u = new User(base);
    const deactivated = u.deactivate();
    expect(deactivated.isActive).toBe(false);
    expect(u.isActive).toBe(true);
  });

  it("records login and updates lastLoginAt", () => {
    const before = Date.now();
    const u = new User(base).recordLogin();
    expect(u.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("throws on login when inactive", () => {
    const u = new User({ ...base, isActive: false });
    expect(() => u.recordLogin()).toThrow(UserInactiveError);
  });

  it("promotes student to teacher", () => {
    const u = new User(base).promoteToTeacher();
    expect(u.role).toBe("teacher");
    expect(u.isTeacher()).toBe(true);
  });

  it("throws when promoting non-student to teacher", () => {
    const teacher = new User({ ...base, role: "teacher" });
    expect(() => teacher.promoteToTeacher()).toThrow("Only students can be promoted to teacher");
  });

  it("updates profile fields", () => {
    const u = new User(base).updateProfile({ name: "Aisha K. Patel", timezone: "America/Toronto" });
    expect(u.name).toBe("Aisha K. Patel");
    expect(u.timezone).toBe("America/Toronto");
    expect(u.email).toBe("aisha@example.com"); // unchanged
  });

  it("toJSON never includes hashedPassword", () => {
    const u = new User({ ...base, hashedPassword: "secret_hash" });
    const json = u.toJSON() as Record<string, unknown>;
    expect("hashedPassword" in json).toBe(false);
  });
});
