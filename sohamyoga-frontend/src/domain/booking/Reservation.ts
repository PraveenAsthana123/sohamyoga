export type ReservationStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "ATTENDED" | "NO_SHOW";

export interface ReservationProps {
  id: string;
  scheduleId: string;
  classId: string;
  studentId: string;
  status: ReservationStatus;
  paymentId?: string;
  amountPaidCAD: number;
  bookedAt: Date;
  cancelledAt?: Date;
  cancelReason?: string;
}

// Domain events
export class ReservationCreatedEvent {
  readonly type = "ReservationCreated" as const;
  constructor(public readonly reservationId: string, public readonly studentId: string, public readonly classId: string) {}
}
export class ReservationCancelledEvent {
  readonly type = "ReservationCancelled" as const;
  constructor(public readonly reservationId: string, public readonly reason: string) {}
}

export class Reservation {
  private _events: (ReservationCreatedEvent | ReservationCancelledEvent)[] = [];

  constructor(private props: ReservationProps) {}

  get id()             { return this.props.id; }
  get scheduleId()     { return this.props.scheduleId; }
  get classId()        { return this.props.classId; }
  get studentId()      { return this.props.studentId; }
  get status()         { return this.props.status; }
  get paymentId()      { return this.props.paymentId; }
  get amountPaidCAD()  { return this.props.amountPaidCAD; }
  get bookedAt()       { return this.props.bookedAt; }
  get cancelledAt()    { return this.props.cancelledAt; }
  get domainEvents()   { return [...this._events]; }

  isActive(): boolean { return this.props.status === "CONFIRMED" || this.props.status === "PENDING"; }

  confirm(paymentId: string): Reservation {
    if (this.props.status !== "PENDING") throw new Error("Only PENDING reservations can be confirmed");
    this.props = { ...this.props, status: "CONFIRMED", paymentId };
    return this;
  }

  cancel(reason: string, withinWindow: boolean): Reservation {
    if (this.props.status === "CANCELLED") throw new Error("Already cancelled");
    if (this.props.status === "ATTENDED")  throw new Error("Cannot cancel an attended session");
    this.props = { ...this.props, status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason };
    this._events.push(new ReservationCancelledEvent(this.props.id, reason));
    return this;
  }

  markAttended(): Reservation {
    if (this.props.status !== "CONFIRMED") throw new Error("Only CONFIRMED reservations can be marked attended");
    this.props = { ...this.props, status: "ATTENDED" };
    return this;
  }

  markNoShow(): Reservation {
    if (this.props.status !== "CONFIRMED") throw new Error("Only CONFIRMED reservations can be marked no-show");
    this.props = { ...this.props, status: "NO_SHOW" };
    return this;
  }

  refundEligible(withinCancellationWindow: boolean): boolean {
    return withinCancellationWindow && this.props.amountPaidCAD > 0;
  }

  static create(props: Omit<ReservationProps, "bookedAt" | "status">): Reservation {
    const r = new Reservation({ ...props, status: "PENDING", bookedAt: new Date() });
    r._events.push(new ReservationCreatedEvent(props.id, props.studentId, props.classId));
    return r;
  }

  toJSON(): ReservationProps { return { ...this.props }; }
}
