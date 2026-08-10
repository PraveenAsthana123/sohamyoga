import { StudentProfile, generateEnrollmentNumber } from "@/domain/student/StudentProfile";

const base = {
  id: "s1",
  userId: "u1",
  enrollmentNumber: "SY-2026-0001",
  firstName: "Priya",
  lastName: "Mehta",
  email: "priya@example.com",
  timezone: "America/Vancouver",
  preferredLanguage: "en",
  status: "active" as const,
  enrolledAt: new Date("2026-01-15"),
  primaryStyle: "Hatha",
  yogaGoals: ["stress_relief" as const],
  experienceYears: 3,
  healthClearanceStatus: "cleared" as const,
  guardians: [],
  totalClassesAttended: 42,
  totalAbsences: 3,
  currentStreakDays: 12,
  loyaltyPoints: 4200,
  outstandingBalance: 0,
  currency: "CAD",
  allowDataSharing: true,
  notes: "",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("StudentProfile", () => {
  it("creates valid profile", () => {
    const s = new StudentProfile(base);
    expect(s.fullName).toBe("Priya Mehta");
    expect(s.enrollmentNumber).toBe("SY-2026-0001");
  });

  it("throws on blank first name", () => {
    expect(() => new StudentProfile({ ...base, firstName: " " })).toThrow("First name required");
  });

  it("throws on blank last name", () => {
    expect(() => new StudentProfile({ ...base, lastName: "" })).toThrow("Last name required");
  });

  it("throws on invalid email", () => {
    expect(() => new StudentProfile({ ...base, email: "not-an-email" })).toThrow("Invalid email address");
  });

  it("throws on negative experience years", () => {
    expect(() => new StudentProfile({ ...base, experienceYears: -1 })).toThrow("Experience years cannot be negative");
  });

  it("throws on negative attendance", () => {
    expect(() => new StudentProfile({ ...base, totalClassesAttended: -1 })).toThrow("Attendance cannot be negative");
  });

  it("attendanceRate — correct calculation", () => {
    expect(new StudentProfile(base).attendanceRate()).toBe(93); // 42/(42+3)
  });

  it("attendanceRate — 0 when no records", () => {
    const s = new StudentProfile({ ...base, totalClassesAttended: 0, totalAbsences: 0 });
    expect(s.attendanceRate()).toBe(0);
  });

  it("isMinor — false when no dateOfBirth", () => {
    expect(new StudentProfile(base).isMinor()).toBe(false);
  });

  it("hasHealthClearance — true when cleared", () => {
    expect(new StudentProfile(base).hasHealthClearance()).toBe(true);
  });

  it("hasHealthClearance — false when pending", () => {
    const s = new StudentProfile({ ...base, healthClearanceStatus: "pending" });
    expect(s.hasHealthClearance()).toBe(false);
  });

  it("isAtRiskChurn — true when active, streak=0, has classes", () => {
    const s = new StudentProfile({ ...base, currentStreakDays: 0 });
    expect(s.isAtRiskChurn()).toBe(true);
  });

  it("isAtRiskChurn — false when streak active", () => {
    expect(new StudentProfile(base).isAtRiskChurn()).toBe(false);
  });

  it("isVip — true when points >= 5000", () => {
    const s = new StudentProfile({ ...base, loyaltyPoints: 5001 });
    expect(s.isVip()).toBe(true);
  });

  it("isVip — true when classes >= 100", () => {
    const s = new StudentProfile({ ...base, totalClassesAttended: 100 });
    expect(s.isVip()).toBe(true);
  });

  it("activate — returns active profile", () => {
    const s = new StudentProfile({ ...base, status: "applicant" }).activate();
    expect(s.status).toBe("active");
  });

  it("hold — changes status to on_hold", () => {
    expect(new StudentProfile(base).hold("Medical leave").status).toBe("on_hold");
  });

  it("drop — changes status to dropped", () => {
    expect(new StudentProfile(base).drop().status).toBe("dropped");
  });

  it("graduate — changes status to alumni", () => {
    expect(new StudentProfile(base).graduate().status).toBe("alumni");
  });

  it("addLoyaltyPoints — adds correctly", () => {
    const s = new StudentProfile(base).addLoyaltyPoints(300);
    expect(s.loyaltyPoints).toBe(4500);
  });

  it("addLoyaltyPoints — throws on negative", () => {
    expect(() => new StudentProfile(base).addLoyaltyPoints(-10)).toThrow("Points must be positive");
  });

  it("linkFrappe — stores frappe ID", () => {
    const s = new StudentProfile(base).linkFrappe("STU-2026-00042");
    expect(s.frappeStudentId).toBe("STU-2026-00042");
  });

  it("linkChatwoot — stores chatwoot ID", () => {
    const s = new StudentProfile(base).linkChatwoot("CW-1084");
    expect(s.chatwootContactId).toBe("CW-1084");
  });

  it("immutable — activate does not mutate original", () => {
    const s = new StudentProfile({ ...base, status: "applicant" });
    s.activate();
    expect(s.status).toBe("applicant");
  });
});

describe("generateEnrollmentNumber", () => {
  it("formats correctly", () => {
    expect(generateEnrollmentNumber(2026, 42)).toBe("SY-2026-0042");
  });

  it("pads to 4 digits", () => {
    expect(generateEnrollmentNumber(2026, 1)).toBe("SY-2026-0001");
  });

  it("handles numbers >= 1000", () => {
    expect(generateEnrollmentNumber(2026, 1000)).toBe("SY-2026-1000");
  });
});
