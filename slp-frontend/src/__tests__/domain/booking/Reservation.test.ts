import { Reservation } from "@/domain/booking/Reservation";

const baseProps = {
  id: "res_1",
  scheduleId: "sched_1",
  classId: "cls_1",
  studentId: "student_1",
  amountPaidCAD: 15,
};

describe("Reservation", () => {
  it("creates in PENDING state with domain event", () => {
    const r = Reservation.create(baseProps);
    expect(r.status).toBe("PENDING");
    expect(r.domainEvents).toHaveLength(1);
    expect(r.domainEvents[0].type).toBe("ReservationCreated");
  });

  it("confirms a PENDING reservation", () => {
    const r = Reservation.create(baseProps).confirm("pay_123");
    expect(r.status).toBe("CONFIRMED");
    expect(r.paymentId).toBe("pay_123");
  });

  it("throws when confirming non-PENDING reservation", () => {
    const r = Reservation.create(baseProps).confirm("pay_1");
    expect(() => r.confirm("pay_2")).toThrow("Only PENDING reservations can be confirmed");
  });

  it("cancels a CONFIRMED reservation", () => {
    const r = Reservation.create(baseProps).confirm("pay_1").cancel("changed mind", true);
    expect(r.status).toBe("CANCELLED");
    expect(r.cancelledAt).toBeDefined();
    const event = r.domainEvents.find(e => e.type === "ReservationCancelled");
    expect(event).toBeDefined();
  });

  it("marks attended from CONFIRMED", () => {
    const r = Reservation.create(baseProps).confirm("pay_1").markAttended();
    expect(r.status).toBe("ATTENDED");
  });

  it("marks no-show from CONFIRMED", () => {
    const r = Reservation.create(baseProps).confirm("pay_1").markNoShow();
    expect(r.status).toBe("NO_SHOW");
  });

  it("throws when cancelling an already-cancelled reservation", () => {
    const r = Reservation.create(baseProps).cancel("reason", true);
    expect(() => r.cancel("again", true)).toThrow("Already cancelled");
  });

  it("throws when cancelling an attended session", () => {
    const r = Reservation.create(baseProps).confirm("pay_1").markAttended();
    expect(() => r.cancel("reason", true)).toThrow("Cannot cancel an attended session");
  });

  it("refund eligible when within window and amount > 0", () => {
    const r = Reservation.create(baseProps).confirm("pay_1");
    expect(r.refundEligible(true)).toBe(true);
    expect(r.refundEligible(false)).toBe(false);
  });

  it("not refund eligible when amount is 0", () => {
    const r = Reservation.create({ ...baseProps, amountPaidCAD: 0 }).confirm("pay_free");
    expect(r.refundEligible(true)).toBe(false);
  });

  it("isActive returns true for PENDING and CONFIRMED", () => {
    const pending = Reservation.create(baseProps);
    const confirmed = Reservation.create({ ...baseProps, id: "res_2" }).confirm("pay_1");
    expect(pending.isActive()).toBe(true);
    expect(confirmed.isActive()).toBe(true);
  });
});
