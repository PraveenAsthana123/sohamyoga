// Booking slot — Cal.com is the source of truth; this mirrors it in the portal
// Used for teacher schedules, 1-on-1 consultations, and trial class bookings

export type SlotType = "class" | "private_session" | "consultation" | "trial" | "workshop" | "retreat_day";
export type SlotStatus = "available" | "booked" | "cancelled" | "completed" | "no_show" | "rescheduled";
export type MeetingMode = "in_person" | "online" | "hybrid";

export interface BookingSlotProps {
  id: string;
  calcomBookingId?: string;      // Cal.com native booking ID
  calcomEventTypeId?: string;    // Cal.com event type
  teacherId: string;
  teacherName: string;
  studentId?: string;            // null if still available
  studentName?: string;
  type: SlotType;
  status: SlotStatus;
  mode: MeetingMode;
  title: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  locationOrLink?: string;       // address or Zoom/Google Meet URL
  maxParticipants: number;
  currentParticipants: number;
  priceAmount: number;
  currency: string;
  isPaid: boolean;
  erpnextInvoiceId?: string;
  cancellationReason?: string;
  rescheduledTo?: Date;
  reminderSentAt?: Date;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BookingSlot {
  constructor(private props: BookingSlotProps) {
    if (!props.title.trim()) throw new Error("Slot title required");
    if (props.endAt <= props.startAt) throw new Error("End time must be after start time");
    if (props.maxParticipants < 1) throw new Error("Max participants must be >= 1");
    if (props.currentParticipants < 0) throw new Error("Current participants cannot be negative");
    if (props.currentParticipants > props.maxParticipants) throw new Error("Current exceeds max participants");
    if (props.priceAmount < 0) throw new Error("Price cannot be negative");
  }

  get id()                 { return this.props.id; }
  get calcomBookingId()    { return this.props.calcomBookingId; }
  get teacherId()          { return this.props.teacherId; }
  get studentId()          { return this.props.studentId; }
  get type()               { return this.props.type; }
  get status()             { return this.props.status; }
  get mode()               { return this.props.mode; }
  get title()              { return this.props.title; }
  get startAt()            { return this.props.startAt; }
  get endAt()              { return this.props.endAt; }
  get timezone()           { return this.props.timezone; }
  get locationOrLink()     { return this.props.locationOrLink; }
  get maxParticipants()    { return this.props.maxParticipants; }
  get currentParticipants(){ return this.props.currentParticipants; }
  get priceAmount()        { return this.props.priceAmount; }
  get isPaid()             { return this.props.isPaid; }
  get erpnextInvoiceId()   { return this.props.erpnextInvoiceId; }
  get cancellationReason() { return this.props.cancellationReason; }
  get notes()              { return this.props.notes; }

  durationMinutes(): number {
    return Math.round((this.props.endAt.getTime() - this.props.startAt.getTime()) / 60000);
  }

  isAvailable(): boolean {
    return this.props.status === "available" && this.props.currentParticipants < this.props.maxParticipants;
  }

  spotsRemaining(): number {
    return Math.max(0, this.props.maxParticipants - this.props.currentParticipants);
  }

  isFull(): boolean { return this.props.currentParticipants >= this.props.maxParticipants; }
  isFree(): boolean { return this.props.priceAmount === 0; }

  book(studentId: string, studentName: string): BookingSlot {
    if (!this.isAvailable()) throw new Error("Slot is not available for booking");
    return new BookingSlot({
      ...this.props,
      status: "booked",
      studentId,
      studentName,
      currentParticipants: this.props.currentParticipants + 1,
      updatedAt: new Date(),
    });
  }

  cancel(reason: string): BookingSlot {
    if (!["available","booked"].includes(this.props.status)) throw new Error("Cannot cancel in current state");
    return new BookingSlot({ ...this.props, status: "cancelled", cancellationReason: reason, updatedAt: new Date() });
  }

  complete(): BookingSlot {
    if (this.props.status !== "booked") throw new Error("Only booked slots can be completed");
    return new BookingSlot({ ...this.props, status: "completed", updatedAt: new Date() });
  }

  markNoShow(): BookingSlot {
    if (this.props.status !== "booked") throw new Error("Only booked slots can be marked no-show");
    return new BookingSlot({ ...this.props, status: "no_show", updatedAt: new Date() });
  }

  reschedule(newStartAt: Date, newEndAt: Date): BookingSlot {
    if (newEndAt <= newStartAt) throw new Error("New end must be after new start");
    return new BookingSlot({ ...this.props, status: "rescheduled", rescheduledTo: newStartAt, startAt: newStartAt, endAt: newEndAt, updatedAt: new Date() });
  }

  markPaid(invoiceId: string): BookingSlot {
    return new BookingSlot({ ...this.props, isPaid: true, erpnextInvoiceId: invoiceId, updatedAt: new Date() });
  }

  toJSON(): BookingSlotProps { return { ...this.props }; }
}
