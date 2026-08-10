// Teacher attendance record per class session
// Check-in via: QR code (LibreBooking), manual (admin), auto (LiveKit webhook, Cal.com)

export type AttendanceMethod = "qr_code" | "manual" | "auto_livekit" | "auto_calcom";
export type TeacherAttendanceStatus = "pending" | "present" | "late" | "absent" | "excused" | "substitute";

export interface TeacherAttendanceProps {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  status: TeacherAttendanceStatus;
  checkInMethod?: AttendanceMethod;
  checkInAt?: Date;
  checkOutAt?: Date;
  lateByMinutes?: number;
  substituteForTeacherId?: string;   // filled when this teacher is a sub
  absenceReason?: string;
  excuseReason?: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const LATE_THRESHOLD_MINUTES = 5;

export class TeacherAttendance {
  constructor(private props: TeacherAttendanceProps) {
    if (!props.classId.trim()) throw new Error("Class ID required");
    if (!props.teacherId.trim()) throw new Error("Teacher ID required");
    if (props.scheduledEndAt <= props.scheduledStartAt) throw new Error("End must be after start");
    if (props.checkInAt && props.checkOutAt && props.checkOutAt <= props.checkInAt)
      throw new Error("Checkout must be after check-in");
  }

  get id()             { return this.props.id; }
  get classId()        { return this.props.classId; }
  get teacherId()      { return this.props.teacherId; }
  get teacherName()    { return this.props.teacherName; }
  get status()         { return this.props.status; }
  get checkInAt()      { return this.props.checkInAt; }
  get checkOutAt()     { return this.props.checkOutAt; }
  get checkInMethod()  { return this.props.checkInMethod; }
  get lateByMinutes()  { return this.props.lateByMinutes; }
  get absenceReason()  { return this.props.absenceReason; }

  isPresent(): boolean { return this.props.status === "present" || this.props.status === "late"; }

  wasLate(): boolean { return this.props.status === "late"; }

  durationMinutes(): number | null {
    if (!this.props.checkInAt || !this.props.checkOutAt) return null;
    return Math.round((this.props.checkOutAt.getTime() - this.props.checkInAt.getTime()) / 60000);
  }

  scheduledDurationMinutes(): number {
    return Math.round((this.props.scheduledEndAt.getTime() - this.props.scheduledStartAt.getTime()) / 60000);
  }

  checkIn(method: AttendanceMethod, at?: Date): TeacherAttendance {
    if (this.props.status !== "pending") throw new Error("Can only check-in from pending state");
    const checkInAt = at ?? new Date();
    const lateByMinutes = Math.max(0, Math.round((checkInAt.getTime() - this.props.scheduledStartAt.getTime()) / 60000));
    const status: TeacherAttendanceStatus = lateByMinutes >= LATE_THRESHOLD_MINUTES ? "late" : "present";
    return new TeacherAttendance({ ...this.props, status, checkInAt, checkInMethod: method, lateByMinutes, updatedAt: new Date() });
  }

  checkOut(at?: Date): TeacherAttendance {
    if (!this.props.checkInAt) throw new Error("Must check in before checking out");
    const checkOutAt = at ?? new Date();
    return new TeacherAttendance({ ...this.props, checkOutAt, updatedAt: new Date() });
  }

  markAbsent(reason: string): TeacherAttendance {
    if (!reason.trim()) throw new Error("Absence reason required");
    if (!["pending", "present", "late"].includes(this.props.status)) throw new Error("Cannot mark absent in current state");
    return new TeacherAttendance({ ...this.props, status: "absent", absenceReason: reason, updatedAt: new Date() });
  }

  excuse(reason: string): TeacherAttendance {
    if (!reason.trim()) throw new Error("Excuse reason required");
    if (this.props.status !== "absent") throw new Error("Can only excuse absent records");
    return new TeacherAttendance({ ...this.props, status: "excused", excuseReason: reason, updatedAt: new Date() });
  }

  markAsSubstitute(originalTeacherId: string): TeacherAttendance {
    return new TeacherAttendance({ ...this.props, status: "substitute", substituteForTeacherId: originalTeacherId, updatedAt: new Date() });
  }

  toJSON(): TeacherAttendanceProps { return { ...this.props }; }
}
