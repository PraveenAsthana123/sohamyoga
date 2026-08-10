import { Enrollment } from "@/domain/student/Enrollment";

const base = {
  id: "e1",
  studentId: "s1",
  courseId: "hatha-fundamentals",
  courseName: "Hatha Fundamentals",
  instructorId: "t1",
  instructorName: "Sunita Patel",
  status: "active" as const,
  feeStatus: "partial" as const,
  feeAmount: 500,
  feeAmountPaid: 250,
  currency: "CAD",
  startDate: new Date("2026-01-01"),
  expectedEndDate: new Date("2026-06-30"),
  attendanceRecords: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Enrollment", () => {
  it("creates valid enrollment", () => {
    const e = new Enrollment(base);
    expect(e.courseName).toBe("Hatha Fundamentals");
    expect(e.feeBalance).toBe(250);
  });

  it("throws on blank course name", () => {
    expect(() => new Enrollment({ ...base, courseName: "" })).toThrow("Course name required");
  });

  it("throws on negative fee", () => {
    expect(() => new Enrollment({ ...base, feeAmount: -1 })).toThrow("Fee amount cannot be negative");
  });

  it("throws when paid > total", () => {
    expect(() => new Enrollment({ ...base, feeAmountPaid: 600 })).toThrow("Fee paid cannot exceed total fee");
  });

  it("throws when end <= start", () => {
    expect(() => new Enrollment({ ...base, expectedEndDate: base.startDate })).toThrow("End date must be after start date");
  });

  it("feeBalance — correct calculation", () => {
    expect(new Enrollment(base).feeBalance).toBe(250);
  });

  it("recordPayment — updates paid amount", () => {
    const e = new Enrollment(base).recordPayment(200);
    expect(e.feeAmountPaid).toBe(450);
    expect(e.feeStatus).toBe("partial");
  });

  it("recordPayment — marks paid when fully paid", () => {
    const e = new Enrollment(base).recordPayment(250);
    expect(e.feeStatus).toBe("paid");
    expect(e.feeAmountPaid).toBe(500);
  });

  it("recordPayment — throws on non-positive amount", () => {
    expect(() => new Enrollment(base).recordPayment(0)).toThrow("Payment amount must be positive");
  });

  it("markActive — pending → active", () => {
    const e = new Enrollment({ ...base, status: "pending" }).markActive();
    expect(e.status).toBe("active");
  });

  it("markActive — throws if not pending", () => {
    expect(() => new Enrollment(base).markActive()).toThrow("Only pending enrollments can be activated");
  });

  it("complete — active → completed", () => {
    const e = new Enrollment(base).complete();
    expect(e.status).toBe("completed");
    expect(e.completedAt).toBeDefined();
  });

  it("drop — requires reason", () => {
    expect(() => new Enrollment(base).drop("  ")).toThrow("Drop reason required");
  });

  it("drop — records reason", () => {
    const e = new Enrollment(base).drop("Moving abroad");
    expect(e.status).toBe("dropped");
    expect(e.dropReason).toBe("Moving abroad");
  });

  it("recordAttendance — adds record", () => {
    const e = new Enrollment(base).recordAttendance({ date: new Date(), classId: "c1", attended: true, excused: false });
    expect(e.totalAttended()).toBe(1);
  });

  it("recordAttendance — idempotent for same date+class", () => {
    const rec = { date: new Date("2026-02-01"), classId: "c1", attended: true, excused: false };
    const e = new Enrollment(base).recordAttendance(rec).recordAttendance(rec);
    expect(e.totalAttended()).toBe(1);
  });

  it("attendanceRate — 100% when all attended", () => {
    const rec = { date: new Date(), classId: "c1", attended: true, excused: false };
    expect(new Enrollment(base).recordAttendance(rec).attendanceRate()).toBe(100);
  });

  it("attendanceRate — 0% with no records", () => {
    expect(new Enrollment(base).attendanceRate()).toBe(0);
  });
});
