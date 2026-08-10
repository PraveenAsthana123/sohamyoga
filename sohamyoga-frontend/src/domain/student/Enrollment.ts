// Course enrollment — state machine, fee status, attendance summary
// Core managed by Frappe Education; state mirrored here for portal display

export type EnrollmentStatus = "pending" | "active" | "completed" | "dropped" | "suspended" | "transferred";
export type FeeStatus = "paid" | "partial" | "pending" | "overdue" | "waived" | "refunded";

export interface AttendanceRecord {
  date: Date;
  classId: string;
  attended: boolean;
  excused: boolean;
  note?: string;
}

export interface EnrollmentProps {
  id: string;
  studentId: string;
  courseId: string;          // Frappe Education course
  courseName: string;
  instructorId: string;
  instructorName: string;
  status: EnrollmentStatus;
  feeStatus: FeeStatus;
  feeAmount: number;
  feeAmountPaid: number;
  currency: string;
  startDate: Date;
  expectedEndDate: Date;
  completedAt?: Date;
  droppedAt?: Date;
  dropReason?: string;
  attendanceRecords: AttendanceRecord[];
  frappeEnrollmentId?: string;
  erpnextFeeEntryId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Enrollment {
  constructor(private props: EnrollmentProps) {
    if (!props.courseName.trim()) throw new Error("Course name required");
    if (props.feeAmount < 0) throw new Error("Fee amount cannot be negative");
    if (props.feeAmountPaid < 0) throw new Error("Fee paid cannot be negative");
    if (props.feeAmountPaid > props.feeAmount) throw new Error("Fee paid cannot exceed total fee");
    if (props.expectedEndDate <= props.startDate) throw new Error("End date must be after start date");
  }

  get id()              { return this.props.id; }
  get studentId()       { return this.props.studentId; }
  get courseId()        { return this.props.courseId; }
  get courseName()      { return this.props.courseName; }
  get status()          { return this.props.status; }
  get feeStatus()       { return this.props.feeStatus; }
  get feeAmount()       { return this.props.feeAmount; }
  get feeAmountPaid()   { return this.props.feeAmountPaid; }
  get feeBalance()      { return this.props.feeAmount - this.props.feeAmountPaid; }
  get startDate()       { return this.props.startDate; }
  get expectedEndDate() { return this.props.expectedEndDate; }
  get dropReason()      { return this.props.dropReason; }
  get frappeEnrollmentId() { return this.props.frappeEnrollmentId; }
  get completedAt()        { return this.props.completedAt; }

  attendanceRate(): number {
    const records = this.props.attendanceRecords;
    if (records.length === 0) return 0;
    const attended = records.filter(r => r.attended || r.excused).length;
    return Math.round((attended / records.length) * 100);
  }

  totalAttended(): number { return this.props.attendanceRecords.filter(r => r.attended).length; }
  totalAbsent(): number   { return this.props.attendanceRecords.filter(r => !r.attended && !r.excused).length; }
  totalExcused(): number  { return this.props.attendanceRecords.filter(r => r.excused).length; }

  isOverdue(): boolean { return this.props.feeStatus === "overdue"; }
  isActive(): boolean  { return this.props.status === "active"; }

  recordPayment(amount: number): Enrollment {
    if (amount <= 0) throw new Error("Payment amount must be positive");
    const newPaid = Math.min(this.props.feeAmountPaid + amount, this.props.feeAmount);
    const newFeeStatus: FeeStatus = newPaid >= this.props.feeAmount ? "paid" : "partial";
    return new Enrollment({ ...this.props, feeAmountPaid: newPaid, feeStatus: newFeeStatus, updatedAt: new Date() });
  }

  markActive(): Enrollment {
    if (this.props.status !== "pending") throw new Error("Only pending enrollments can be activated");
    return new Enrollment({ ...this.props, status: "active", updatedAt: new Date() });
  }

  complete(): Enrollment {
    if (this.props.status !== "active") throw new Error("Only active enrollments can be completed");
    return new Enrollment({ ...this.props, status: "completed", completedAt: new Date(), updatedAt: new Date() });
  }

  drop(reason: string): Enrollment {
    if (!["active", "suspended"].includes(this.props.status)) throw new Error("Cannot drop in current state");
    if (!reason.trim()) throw new Error("Drop reason required");
    return new Enrollment({ ...this.props, status: "dropped", dropReason: reason, droppedAt: new Date(), updatedAt: new Date() });
  }

  recordAttendance(record: AttendanceRecord): Enrollment {
    const exists = this.props.attendanceRecords.some(r =>
      r.date.toDateString() === record.date.toDateString() && r.classId === record.classId
    );
    if (exists) return this;
    return new Enrollment({ ...this.props, attendanceRecords: [...this.props.attendanceRecords, record], updatedAt: new Date() });
  }

  toJSON(): EnrollmentProps {
    return {
      ...this.props,
      attendanceRecords: this.props.attendanceRecords.map(r => ({ ...r })),
    };
  }
}
