import { TeacherPerformance } from "@/domain/teacher/TeacherPerformance";

const base = {
  id: "tp1",
  teacherId: "t1",
  teacherName: "Sunita Patel",
  period: "monthly" as const,
  periodStart: new Date("2026-08-01"),
  periodEnd: new Date("2026-08-31"),
  totalScheduledClasses: 20,
  totalCancelledClasses: 2,
  totalCompletedClasses: 18,
  totalStudentAttendees: 180,
  uniqueStudents: 40,
  newStudents: 8,
  returningStudents: 30,
  droppedStudents: 5,
  avgStudentRating: 4.7,
  totalRatings: 95,
  npsScore: 62,
  totalRevenue: 3600,
  currency: "CAD",
  createdAt: new Date(),
};

describe("TeacherPerformance", () => {
  it("creates valid performance record", () => {
    const p = new TeacherPerformance(base);
    expect(p.teacherName).toBe("Sunita Patel");
    expect(p.period).toBe("monthly");
  });

  it("throws on empty teacher ID", () => {
    expect(() => new TeacherPerformance({ ...base, teacherId: "" })).toThrow("Teacher ID required");
  });

  it("throws when period end == start", () => {
    expect(() => new TeacherPerformance({ ...base, periodEnd: base.periodStart })).toThrow("Period end must be after start");
  });

  it("throws when cancelled > scheduled", () => {
    expect(() => new TeacherPerformance({ ...base, totalCancelledClasses: 25 })).toThrow("Cancelled cannot exceed scheduled");
  });

  it("throws on invalid rating", () => {
    expect(() => new TeacherPerformance({ ...base, avgStudentRating: 6 })).toThrow("Rating must be 0–5");
  });

  it("throws on invalid NPS", () => {
    expect(() => new TeacherPerformance({ ...base, npsScore: 150 })).toThrow("NPS must be –100 to +100");
  });

  it("throws on negative revenue", () => {
    expect(() => new TeacherPerformance({ ...base, totalRevenue: -1 })).toThrow("Revenue cannot be negative");
  });

  it("cancellationRate — 10% for 2 of 20", () => {
    expect(new TeacherPerformance(base).cancellationRate()).toBe(10);
  });

  it("cancellationRate — 0 when no scheduled", () => {
    const p = new TeacherPerformance({ ...base, totalScheduledClasses: 0, totalCancelledClasses: 0, totalCompletedClasses: 0 });
    expect(p.cancellationRate()).toBe(0);
  });

  it("completionRate — 90% for 18 of 20", () => {
    expect(new TeacherPerformance(base).completionRate()).toBe(90);
  });

  it("avgAttendeesPerClass — 10 for 180/18", () => {
    expect(new TeacherPerformance(base).avgAttendeesPerClass()).toBe(10);
  });

  it("avgAttendeesPerClass — 0 when no completed classes", () => {
    const p = new TeacherPerformance({ ...base, totalCompletedClasses: 0, totalStudentAttendees: 0 });
    expect(p.avgAttendeesPerClass()).toBe(0);
  });

  it("retentionRate — 86% for 30/(30+5)", () => {
    expect(new TeacherPerformance(base).retentionRate()).toBe(86);
  });

  it("retentionRate — 0 when no return/drop data", () => {
    const p = new TeacherPerformance({ ...base, returningStudents: 0, droppedStudents: 0 });
    expect(p.retentionRate()).toBe(0);
  });

  it("npsCategory — promoter at 62", () => {
    expect(new TeacherPerformance(base).npsCategory()).toBe("promoter");
  });

  it("npsCategory — passive at 20", () => {
    expect(new TeacherPerformance({ ...base, npsScore: 20 }).npsCategory()).toBe("passive");
  });

  it("npsCategory — detractor at -10", () => {
    expect(new TeacherPerformance({ ...base, npsScore: -10 }).npsCategory()).toBe("detractor");
  });

  it("npsCategory — no_data when null", () => {
    expect(new TeacherPerformance({ ...base, npsScore: null }).npsCategory()).toBe("no_data");
  });

  it("isHighPerformer — true for rating>=4.5 and completionRate>=90", () => {
    expect(new TeacherPerformance(base).isHighPerformer()).toBe(true);
  });

  it("isHighPerformer — false when low rating", () => {
    expect(new TeacherPerformance({ ...base, avgStudentRating: 3.5 }).isHighPerformer()).toBe(false);
  });

  it("isHighPerformer — false when high cancellation", () => {
    const p = new TeacherPerformance({ ...base, totalCancelledClasses: 5, totalCompletedClasses: 15 });
    expect(p.isHighPerformer()).toBe(false);
  });

  it("revenuePerClass — 200 for 3600/18", () => {
    expect(new TeacherPerformance(base).revenuePerClass()).toBe(200);
  });
});
