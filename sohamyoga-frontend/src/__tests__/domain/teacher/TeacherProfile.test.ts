import { TeacherProfile } from "@/domain/teacher/TeacherProfile";

const base = {
  id: "t1",
  userId: "u1",
  firstName: "Sunita",
  lastName: "Patel",
  email: "sunita@sohamyoga.com",
  bio: "20 years of teaching Hatha and Yin yoga",
  timezone: "America/Toronto",
  status: "active" as const,
  contractType: "employee" as const,
  hireDate: new Date("2022-01-15"),
  department: "Yoga Instruction",
  designation: "Lead Teacher",
  hourlyRate: 45,
  currency: "CAD",
  specializations: ["Hatha" as const, "Yin" as const],
  certifications: [],
  yearsTeaching: 20,
  maxClassSize: 20,
  canTeachOnline: true,
  canTeachKids: false,
  canTeachPrenatal: true,
  languages: ["English", "Hindi"],
  totalClassesTaught: 312,
  avgStudentRating: 4.9,
  totalStudents: 84,
  upcomingClasses: 6,
  moodleCoursesCompleted: ["yoga-anatomy-101"],
  cpd_hoursThisYear: 8,
  isPublicProfile: true,
  notes: "",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("TeacherProfile", () => {
  it("creates valid teacher profile", () => {
    const t = new TeacherProfile(base);
    expect(t.fullName).toBe("Sunita Patel");
    expect(t.designation).toBe("Lead Teacher");
  });

  it("throws on empty first name", () => {
    expect(() => new TeacherProfile({ ...base, firstName: " " })).toThrow("First name required");
  });

  it("throws on invalid email", () => {
    expect(() => new TeacherProfile({ ...base, email: "notvalid" })).toThrow("Invalid email");
  });

  it("throws on empty specializations", () => {
    expect(() => new TeacherProfile({ ...base, specializations: [] })).toThrow("At least one specialization required");
  });

  it("throws on negative hourly rate", () => {
    expect(() => new TeacherProfile({ ...base, hourlyRate: -1 })).toThrow("Hourly rate cannot be negative");
  });

  it("throws on invalid rating", () => {
    expect(() => new TeacherProfile({ ...base, avgStudentRating: 6 })).toThrow("Rating must be 0–5");
  });

  it("isActive — true for active status", () => {
    expect(new TeacherProfile(base).isActive()).toBe(true);
  });

  it("isEmployed — true for employee type", () => {
    expect(new TeacherProfile(base).isEmployed()).toBe(true);
  });

  it("isEmployed — false for contractor", () => {
    const t = new TeacherProfile({ ...base, contractType: "contractor" });
    expect(t.isEmployed()).toBe(false);
  });

  it("canTeach — true for Hatha", () => {
    expect(new TeacherProfile(base).canTeach("Hatha")).toBe(true);
  });

  it("canTeach — false for unlisted specialization", () => {
    expect(new TeacherProfile(base).canTeach("Power")).toBe(false);
  });

  it("hasValidCertification — false when no certs", () => {
    expect(new TeacherProfile(base).hasValidCertification("RYT-200")).toBe(false);
  });

  it("hasValidCertification — true when valid cert exists", () => {
    const t = new TeacherProfile(base).addCertification({
      id: "c1", name: "RYT-200", issuingBody: "Yoga Alliance",
      issueDate: new Date("2020-01-01"), verified: true,
    });
    expect(t.hasValidCertification("RYT-200")).toBe(true);
  });

  it("hasValidCertification — false when cert expired", () => {
    const t = new TeacherProfile(base).addCertification({
      id: "c1", name: "RYT-200", issuingBody: "Yoga Alliance",
      issueDate: new Date("2020-01-01"),
      expiryDate: new Date("2021-01-01"),  // expired
      verified: true,
    });
    expect(t.hasValidCertification("RYT-200")).toBe(false);
  });

  it("expiredCertifications — returns expired only", () => {
    const t = new TeacherProfile(base)
      .addCertification({ id: "c1", name: "RYT-200", issuingBody: "YA", issueDate: new Date(), expiryDate: new Date("2021-01-01"), verified: true })
      .addCertification({ id: "c2", name: "RYT-500", issuingBody: "YA", issueDate: new Date(), expiryDate: new Date("2028-01-01"), verified: true });
    expect(t.expiredCertifications()).toHaveLength(1);
  });

  it("linkFrappeHR — stores employee ID", () => {
    const t = new TeacherProfile(base).linkFrappeHR("EMP-00042");
    expect(t.frappeEmployeeId).toBe("EMP-00042");
  });

  it("linkCalcom — stores calcom user ID", () => {
    const t = new TeacherProfile(base).linkCalcom("calcom_u_123");
    expect(t.calcomUserId).toBe("calcom_u_123");
  });

  it("linkMoodle — stores moodle user ID", () => {
    const t = new TeacherProfile(base).linkMoodle("moodle_u_456");
    expect(t.moodleUserId).toBe("moodle_u_456");
  });

  it("retire — active → retired", () => {
    const t = new TeacherProfile(base).retire();
    expect(t.status).toBe("retired");
  });

  it("retire — throws from invalid state", () => {
    const t = new TeacherProfile({ ...base, status: "terminated" });
    expect(() => t.retire()).toThrow("Can only retire active or on-leave teachers");
  });

  it("immutable — retire does not modify original", () => {
    const t = new TeacherProfile(base);
    t.retire();
    expect(t.status).toBe("active");
  });

  it("returns defensive copy of specializations", () => {
    const t = new TeacherProfile(base);
    const specs = t.specializations;
    specs.push("Power");
    expect(t.specializations).toHaveLength(2);
  });
});
