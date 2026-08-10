import { BookingSlot } from "@/domain/scheduling/BookingSlot";

const START = new Date("2026-09-15T09:00:00Z");
const END   = new Date("2026-09-15T10:00:00Z");

const base = {
  id: "bs1",
  teacherId: "t1",
  teacherName: "Sunita Patel",
  type: "class" as const,
  status: "available" as const,
  mode: "in_person" as const,
  title: "Morning Hatha Flow",
  startAt: START,
  endAt: END,
  timezone: "America/Toronto",
  maxParticipants: 15,
  currentParticipants: 0,
  priceAmount: 25,
  currency: "CAD",
  isPaid: false,
  notes: "",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("BookingSlot", () => {
  it("creates valid slot", () => {
    const s = new BookingSlot(base);
    expect(s.title).toBe("Morning Hatha Flow");
    expect(s.status).toBe("available");
  });

  it("throws on blank title", () => {
    expect(() => new BookingSlot({ ...base, title: "" })).toThrow("Slot title required");
  });

  it("throws when end <= start", () => {
    expect(() => new BookingSlot({ ...base, endAt: START })).toThrow("End time must be after start time");
  });

  it("throws on zero max participants", () => {
    expect(() => new BookingSlot({ ...base, maxParticipants: 0 })).toThrow("Max participants must be >= 1");
  });

  it("throws when current > max participants", () => {
    expect(() => new BookingSlot({ ...base, currentParticipants: 20 })).toThrow("Current exceeds max participants");
  });

  it("throws on negative price", () => {
    expect(() => new BookingSlot({ ...base, priceAmount: -5 })).toThrow("Price cannot be negative");
  });

  it("durationMinutes — correct calculation", () => {
    expect(new BookingSlot(base).durationMinutes()).toBe(60);
  });

  it("isAvailable — true when available and not full", () => {
    expect(new BookingSlot(base).isAvailable()).toBe(true);
  });

  it("isAvailable — false when status is booked", () => {
    expect(new BookingSlot({ ...base, status: "booked" }).isAvailable()).toBe(false);
  });

  it("isAvailable — false when full", () => {
    const s = new BookingSlot({ ...base, currentParticipants: 15 });
    expect(s.isAvailable()).toBe(false);
  });

  it("spotsRemaining — correct count", () => {
    const s = new BookingSlot({ ...base, currentParticipants: 5 });
    expect(s.spotsRemaining()).toBe(10);
  });

  it("isFull — true at capacity", () => {
    const s = new BookingSlot({ ...base, currentParticipants: 15 });
    expect(s.isFull()).toBe(true);
  });

  it("isFree — true for zero price", () => {
    expect(new BookingSlot({ ...base, priceAmount: 0 }).isFree()).toBe(true);
  });

  it("book — available → booked, increments participants", () => {
    const s = new BookingSlot(base).book("s1", "Priya Mehta");
    expect(s.status).toBe("booked");
    expect(s.currentParticipants).toBe(1);
    expect(s.studentId).toBe("s1");
  });

  it("book — throws when not available", () => {
    const s = new BookingSlot({ ...base, status: "booked" });
    expect(() => s.book("s2", "Rajan")).toThrow("Slot is not available for booking");
  });

  it("cancel — records reason", () => {
    const s = new BookingSlot(base).cancel("Teacher sick");
    expect(s.status).toBe("cancelled");
    expect(s.cancellationReason).toBeDefined();
  });

  it("complete — booked → completed", () => {
    const s = new BookingSlot({ ...base, status: "booked" }).complete();
    expect(s.status).toBe("completed");
  });

  it("complete — throws if not booked", () => {
    expect(() => new BookingSlot(base).complete()).toThrow("Only booked slots can be completed");
  });

  it("markNoShow — booked → no_show", () => {
    const s = new BookingSlot({ ...base, status: "booked" }).markNoShow();
    expect(s.status).toBe("no_show");
  });

  it("reschedule — updates times", () => {
    const newStart = new Date("2026-09-16T09:00:00Z");
    const newEnd   = new Date("2026-09-16T10:00:00Z");
    const s = new BookingSlot(base).reschedule(newStart, newEnd);
    expect(s.status).toBe("rescheduled");
    expect(s.startAt).toEqual(newStart);
  });

  it("reschedule — throws when new end <= new start", () => {
    expect(() => new BookingSlot(base).reschedule(START, START)).toThrow("New end must be after new start");
  });

  it("markPaid — records invoice ID", () => {
    const s = new BookingSlot(base).markPaid("INV-2026-001");
    expect(s.isPaid).toBe(true);
    expect(s.erpnextInvoiceId).toBe("INV-2026-001");
  });

  it("immutable — book does not modify original", () => {
    const s = new BookingSlot(base);
    s.book("s1", "Priya");
    expect(s.status).toBe("available");
    expect(s.currentParticipants).toBe(0);
  });
});
