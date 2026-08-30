import { TeacherAvailability } from "@/domain/teacher/TeacherAvailability";

const window1 = { dayOfWeek: "Mon" as const, startHour: 9,  startMinute: 0, endHour: 12, endMinute: 0 };
const window2 = { dayOfWeek: "Mon" as const, startHour: 15, startMinute: 0, endHour: 17, endMinute: 0 };
const window3 = { dayOfWeek: "Wed" as const, startHour: 9,  startMinute: 0, endHour: 11, endMinute: 0 };

const block1: import("@/domain/teacher/TeacherAvailability").BlockedPeriod = {
  id: "bp1", reason: "vacation", label: "Summer vacation",
  startAt: new Date("2026-08-01"), endAt: new Date("2026-08-15"),
  notifyStudents: true,
};

const base = {
  id: "av1",
  teacherId: "t1",
  timezone: "America/Toronto",
  weeklyWindows: [window1, window2, window3],
  blockedPeriods: [],
  defaultClassDurationMinutes: 60,
  bufferMinutes: 15,
  maxClassesPerDay: 4,
  maxClassesPerWeek: 12,
  allowOnlineBooking: true,
  notes: "",
  updatedAt: new Date(),
};

describe("TeacherAvailability", () => {
  it("creates valid availability record", () => {
    const a = new TeacherAvailability(base);
    expect(a.teacherId).toBe("t1");
    expect(a.weeklyWindows).toHaveLength(3);
  });

  it("throws on empty teacher ID", () => {
    expect(() => new TeacherAvailability({ ...base, teacherId: "" })).toThrow("Teacher ID required");
  });

  it("throws on zero class duration", () => {
    expect(() => new TeacherAvailability({ ...base, defaultClassDurationMinutes: 0 })).toThrow("Class duration must be >= 1 minute");
  });

  it("throws on negative buffer", () => {
    expect(() => new TeacherAvailability({ ...base, bufferMinutes: -1 })).toThrow("Buffer cannot be negative");
  });

  it("throws when window end == start", () => {
    const badWindow = { dayOfWeek: "Tue" as const, startHour: 9, startMinute: 0, endHour: 9, endMinute: 0 };
    expect(() => new TeacherAvailability({ ...base, weeklyWindows: [badWindow] })).toThrow("Window end must be after start on Tue");
  });

  it("throws when blocked period end <= start", () => {
    const badBlock = { ...block1, startAt: new Date("2026-08-10"), endAt: new Date("2026-08-05") };
    expect(() => new TeacherAvailability({ ...base, blockedPeriods: [badBlock] })).toThrow("Blocked period end must be after start");
  });

  it("windowsForDay — returns correct windows", () => {
    const a = new TeacherAvailability(base);
    expect(a.windowsForDay("Mon")).toHaveLength(2);
    expect(a.windowsForDay("Wed")).toHaveLength(1);
    expect(a.windowsForDay("Fri")).toHaveLength(0);
  });

  it("isBlockedOn — false when no blocked periods", () => {
    expect(new TeacherAvailability(base).isBlockedOn(new Date("2026-08-05"))).toBe(false);
  });

  it("isBlockedOn — true when date in block", () => {
    const a = new TeacherAvailability({ ...base, blockedPeriods: [block1] });
    expect(a.isBlockedOn(new Date("2026-08-10"))).toBe(true);
  });

  it("isBlockedOn — false outside block range", () => {
    const a = new TeacherAvailability({ ...base, blockedPeriods: [block1] });
    expect(a.isBlockedOn(new Date("2026-07-31"))).toBe(false);
    expect(a.isBlockedOn(new Date("2026-08-16"))).toBe(false);
  });

  it("addBlockedPeriod — appends period", () => {
    const a = new TeacherAvailability(base).addBlockedPeriod(block1);
    expect(a.blockedPeriods).toHaveLength(1);
  });

  it("removeBlockedPeriod — removes by ID", () => {
    const a = new TeacherAvailability({ ...base, blockedPeriods: [block1] }).removeBlockedPeriod("bp1");
    expect(a.blockedPeriods).toHaveLength(0);
  });

  it("upcomingBlocks — excludes past blocks", () => {
    const past = { ...block1, id: "bp2", startAt: new Date("2020-01-01"), endAt: new Date("2020-01-07") };
    const a = new TeacherAvailability({ ...base, blockedPeriods: [block1, past] });
    expect(a.upcomingBlocks(new Date("2026-07-01"))).toHaveLength(1);
  });

  it("upcomingBlocks — sorted by start", () => {
    const second = { ...block1, id: "bp2", startAt: new Date("2026-09-01"), endAt: new Date("2026-09-07") };
    const a = new TeacherAvailability({ ...base, blockedPeriods: [second, block1] });
    const upcoming = a.upcomingBlocks(new Date("2026-07-01"));
    expect(upcoming[0].id).toBe("bp1");
    expect(upcoming[1].id).toBe("bp2");
  });

  it("addWindow — appends window", () => {
    const newW = { dayOfWeek: "Fri" as const, startHour: 10, startMinute: 0, endHour: 11, endMinute: 0 };
    const a = new TeacherAvailability(base).addWindow(newW);
    expect(a.windowsForDay("Fri")).toHaveLength(1);
  });

  it("removeWindowsForDay — removes all for that day", () => {
    const a = new TeacherAvailability(base).removeWindowsForDay("Mon");
    expect(a.windowsForDay("Mon")).toHaveLength(0);
    expect(a.windowsForDay("Wed")).toHaveLength(1);
  });

  it("immutable — addBlockedPeriod does not modify original", () => {
    const a = new TeacherAvailability(base);
    a.addBlockedPeriod(block1);
    expect(a.blockedPeriods).toHaveLength(0);
  });

  it("defensive copy — mutating returned windows does not affect internal state", () => {
    const a = new TeacherAvailability(base);
    const windows = a.weeklyWindows;
    windows.push({ dayOfWeek: "Fri", startHour: 10, startMinute: 0, endHour: 11, endMinute: 0 });
    expect(a.weeklyWindows).toHaveLength(3);
  });
});
