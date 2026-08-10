import { TeacherAttendance } from "@/domain/teacher/TeacherAttendance";

const START = new Date("2026-09-15T09:00:00Z");
const END   = new Date("2026-09-15T10:00:00Z");

const base = {
  id: "ta1",
  classId: "cls1",
  className: "Morning Hatha Flow",
  teacherId: "t1",
  teacherName: "Sunita Patel",
  scheduledStartAt: START,
  scheduledEndAt: END,
  status: "pending" as const,
  notes: "",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("TeacherAttendance", () => {
  it("creates valid attendance record", () => {
    const a = new TeacherAttendance(base);
    expect(a.status).toBe("pending");
    expect(a.teacherName).toBe("Sunita Patel");
  });

  it("throws on empty class ID", () => {
    expect(() => new TeacherAttendance({ ...base, classId: "" })).toThrow("Class ID required");
  });

  it("throws on empty teacher ID", () => {
    expect(() => new TeacherAttendance({ ...base, teacherId: "" })).toThrow("Teacher ID required");
  });

  it("throws when end <= start", () => {
    expect(() => new TeacherAttendance({ ...base, scheduledEndAt: START })).toThrow("End must be after start");
  });

  it("throws when checkout before check-in", () => {
    const checkIn = new Date("2026-09-15T09:05:00Z");
    const checkOut = new Date("2026-09-15T09:00:00Z");
    expect(() => new TeacherAttendance({ ...base, status: "present", checkInAt: checkIn, checkOutAt: checkOut })).toThrow("Checkout must be after check-in");
  });

  it("isPresent — false for pending", () => {
    expect(new TeacherAttendance(base).isPresent()).toBe(false);
  });

  it("isPresent — true for present", () => {
    const a = new TeacherAttendance({ ...base, status: "present" });
    expect(a.isPresent()).toBe(true);
  });

  it("isPresent — true for late", () => {
    expect(new TeacherAttendance({ ...base, status: "late" }).isPresent()).toBe(true);
  });

  it("wasLate — true for late", () => {
    expect(new TeacherAttendance({ ...base, status: "late" }).wasLate()).toBe(true);
  });

  it("durationMinutes — null when no checkout", () => {
    expect(new TeacherAttendance(base).durationMinutes()).toBeNull();
  });

  it("scheduledDurationMinutes — correct for 1 hour", () => {
    expect(new TeacherAttendance(base).scheduledDurationMinutes()).toBe(60);
  });

  it("checkIn — on time marks as present", () => {
    const onTime = new Date("2026-09-15T09:02:00Z");
    const a = new TeacherAttendance(base).checkIn("manual", onTime);
    expect(a.status).toBe("present");
    expect(a.checkInAt).toEqual(onTime);
  });

  it("checkIn — 10 min late marks as late", () => {
    const late = new Date("2026-09-15T09:10:00Z");
    const a = new TeacherAttendance(base).checkIn("qr_code", late);
    expect(a.status).toBe("late");
    expect(a.lateByMinutes).toBe(10);
  });

  it("checkIn — throws if not pending", () => {
    const a = new TeacherAttendance({ ...base, status: "absent" });
    expect(() => a.checkIn("manual")).toThrow("Can only check-in from pending state");
  });

  it("checkOut — records checkout time", () => {
    const checkIn  = new Date("2026-09-15T09:00:00Z");
    const checkOut = new Date("2026-09-15T10:00:00Z");
    const a = new TeacherAttendance(base).checkIn("auto_calcom", checkIn).checkOut(checkOut);
    expect(a.durationMinutes()).toBe(60);
  });

  it("checkOut — throws if not checked in", () => {
    expect(() => new TeacherAttendance(base).checkOut()).toThrow("Must check in before checking out");
  });

  it("markAbsent — requires reason", () => {
    expect(() => new TeacherAttendance(base).markAbsent("  ")).toThrow("Absence reason required");
  });

  it("markAbsent — pending → absent", () => {
    const a = new TeacherAttendance(base).markAbsent("Sick day");
    expect(a.status).toBe("absent");
    expect(a.absenceReason).toBe("Sick day");
  });

  it("excuse — absent → excused", () => {
    const a = new TeacherAttendance(base).markAbsent("Sick").excuse("Medical emergency");
    expect(a.status).toBe("excused");
  });

  it("excuse — throws if not absent", () => {
    expect(() => new TeacherAttendance(base).excuse("reason")).toThrow("Can only excuse absent records");
  });

  it("markAsSubstitute — records original teacher", () => {
    const a = new TeacherAttendance(base).markAsSubstitute("t2");
    expect(a.status).toBe("substitute");
  });

  it("immutable — checkIn does not modify original", () => {
    const a = new TeacherAttendance(base);
    a.checkIn("manual", new Date());
    expect(a.status).toBe("pending");
  });
});
