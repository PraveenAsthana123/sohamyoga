// Substitute teacher workflow — Flowable-driven state machine
// Lifecycle: requested → approved/rejected; approved → covered/missed

export type SubstituteStatus =
  | "requested"   // original teacher requests a sub
  | "approved"    // admin approved; waiting for sub to confirm
  | "rejected"    // admin rejected
  | "covered"     // substitute teacher took the class
  | "missed"      // no substitute found in time; class not covered
  | "cancelled";  // request withdrawn before class

export interface SubstituteRequestProps {
  id: string;
  classId: string;
  className: string;
  classDate: Date;
  originalTeacherId: string;
  originalTeacherName: string;
  substituteTeacherId?: string;
  substituteTeacherName?: string;
  status: SubstituteStatus;
  reason: string;                // why the original teacher cannot attend
  requestedAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  rejectedAt?: Date;
  rejectReason?: string;
  coveredAt?: Date;
  cancellationReason?: string;
  notes: string;
  updatedAt: Date;
}

export class SubstituteRequest {
  constructor(private props: SubstituteRequestProps) {
    if (!props.classId.trim()) throw new Error("Class ID required");
    if (!props.reason.trim()) throw new Error("Reason required");
    if (!props.originalTeacherId.trim()) throw new Error("Original teacher ID required");
  }

  get id()                    { return this.props.id; }
  get classId()               { return this.props.classId; }
  get className()             { return this.props.className; }
  get classDate()             { return this.props.classDate; }
  get status()                { return this.props.status; }
  get reason()                { return this.props.reason; }
  get originalTeacherId()     { return this.props.originalTeacherId; }
  get substituteTeacherId()   { return this.props.substituteTeacherId; }
  get substituteTeacherName() { return this.props.substituteTeacherName; }
  get approvedBy()            { return this.props.approvedBy; }
  get rejectReason()          { return this.props.rejectReason; }
  get cancellationReason()    { return this.props.cancellationReason; }

  isPending(): boolean {
    return this.props.status === "requested" || this.props.status === "approved";
  }

  isResolved(): boolean {
    return ["covered", "missed", "rejected", "cancelled"].includes(this.props.status);
  }

  hasSubstitute(): boolean {
    return !!this.props.substituteTeacherId;
  }

  approve(approvedBy: string): SubstituteRequest {
    if (this.props.status !== "requested") throw new Error("Can only approve a requested substitute");
    if (!approvedBy.trim()) throw new Error("Approver ID required");
    return new SubstituteRequest({ ...this.props, status: "approved", approvedBy, approvedAt: new Date(), updatedAt: new Date() });
  }

  reject(reason: string): SubstituteRequest {
    if (!reason.trim()) throw new Error("Rejection reason required");
    if (this.props.status !== "requested") throw new Error("Can only reject a requested substitute");
    return new SubstituteRequest({ ...this.props, status: "rejected", rejectReason: reason, rejectedAt: new Date(), updatedAt: new Date() });
  }

  assignSubstitute(teacherId: string, teacherName: string): SubstituteRequest {
    if (this.props.status !== "approved") throw new Error("Can only assign substitute to approved request");
    if (!teacherId.trim()) throw new Error("Substitute teacher ID required");
    return new SubstituteRequest({ ...this.props, substituteTeacherId: teacherId, substituteTeacherName: teacherName, updatedAt: new Date() });
  }

  cover(): SubstituteRequest {
    if (this.props.status !== "approved") throw new Error("Can only mark covered from approved state");
    if (!this.props.substituteTeacherId) throw new Error("No substitute assigned");
    return new SubstituteRequest({ ...this.props, status: "covered", coveredAt: new Date(), updatedAt: new Date() });
  }

  miss(): SubstituteRequest {
    if (this.props.status !== "approved") throw new Error("Can only mark missed from approved state");
    return new SubstituteRequest({ ...this.props, status: "missed", updatedAt: new Date() });
  }

  cancel(reason: string): SubstituteRequest {
    if (!reason.trim()) throw new Error("Cancellation reason required");
    if (!["requested", "approved"].includes(this.props.status)) throw new Error("Cannot cancel in current state");
    return new SubstituteRequest({ ...this.props, status: "cancelled", cancellationReason: reason, updatedAt: new Date() });
  }

  toJSON(): SubstituteRequestProps { return { ...this.props }; }
}
