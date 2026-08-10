// Student profile — core managed by Frappe Education; yoga-specific fields custom-built

import type { YogaGoal } from "@/domain/wellness/WellnessProfile";

export type StudentStatus = "applicant" | "active" | "on_hold" | "completed" | "dropped" | "alumni";
export type HealthClearanceStatus = "not_required" | "pending" | "cleared" | "cleared_with_restrictions";

export interface GuardianInfo {
  name: string;
  relationship: string;
  email: string;
  phone: string;
  isEmergencyContact: boolean;
}

export interface StudentProfileProps {
  id: string;
  userId: string;               // links to Identity domain
  enrollmentNumber: string;     // auto-generated, e.g. "SY-2026-0042"
  frappeStudentId?: string;     // Frappe Education native ID after sync
  chatwootContactId?: string;   // Chatwoot contact for support history
  erpnextCustomerId?: string;   // ERPNext customer for billing

  // Personal
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: Date;
  pronouns?: string;
  avatarUrl?: string;
  timezone: string;
  preferredLanguage: string;

  // Enrollment
  status: StudentStatus;
  enrolledAt: Date;
  primaryStyle: string;          // "Hatha", "Vinyasa", etc.
  yogaGoals: YogaGoal[];
  experienceYears: number;

  // Health
  healthClearanceStatus: HealthClearanceStatus;
  healthClearanceNote?: string;
  guardians: GuardianInfo[];     // for minors or emergency contacts

  // Progress snapshot (updated by batch job)
  totalClassesAttended: number;
  totalAbsences: number;
  currentStreakDays: number;
  loyaltyPoints: number;

  // Financial (mirrored from ERPNext)
  outstandingBalance: number;
  currency: string;

  // Privacy
  allowDataSharing: boolean;
  gdprConsentAt?: Date;

  notes: string;                 // admin notes (private)
  createdAt: Date;
  updatedAt: Date;
}

export class StudentProfile {
  constructor(private props: StudentProfileProps) {
    if (!props.firstName.trim()) throw new Error("First name required");
    if (!props.lastName.trim()) throw new Error("Last name required");
    if (!props.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) throw new Error("Invalid email address");
    if (props.experienceYears < 0) throw new Error("Experience years cannot be negative");
    if (props.totalClassesAttended < 0) throw new Error("Attendance cannot be negative");
  }

  get id()                   { return this.props.id; }
  get userId()               { return this.props.userId; }
  get enrollmentNumber()     { return this.props.enrollmentNumber; }
  get status()               { return this.props.status; }
  get firstName()            { return this.props.firstName; }
  get lastName()             { return this.props.lastName; }
  get fullName()             { return `${this.props.firstName} ${this.props.lastName}`; }
  get email()                { return this.props.email; }
  get phone()                { return this.props.phone; }
  get timezone()             { return this.props.timezone; }
  get primaryStyle()         { return this.props.primaryStyle; }
  get yogaGoals()            { return [...this.props.yogaGoals]; }
  get healthClearanceStatus(){ return this.props.healthClearanceStatus; }
  get totalClassesAttended() { return this.props.totalClassesAttended; }
  get totalAbsences()        { return this.props.totalAbsences; }
  get currentStreakDays()    { return this.props.currentStreakDays; }
  get loyaltyPoints()        { return this.props.loyaltyPoints; }
  get outstandingBalance()   { return this.props.outstandingBalance; }
  get guardians()            { return this.props.guardians.map(g => ({ ...g })); }
  get notes()                { return this.props.notes; }
  get frappeStudentId()      { return this.props.frappeStudentId; }
  get chatwootContactId()    { return this.props.chatwootContactId; }
  get erpnextCustomerId()    { return this.props.erpnextCustomerId; }

  attendanceRate(): number {
    const total = this.props.totalClassesAttended + this.props.totalAbsences;
    if (total === 0) return 0;
    return Math.round((this.props.totalClassesAttended / total) * 100);
  }

  isMinor(): boolean {
    if (!this.props.dateOfBirth) return false;
    const age = Math.floor((Date.now() - this.props.dateOfBirth.getTime()) / (365.25 * 86400000));
    return age < 18;
  }

  hasHealthClearance(): boolean {
    return ["cleared", "cleared_with_restrictions"].includes(this.props.healthClearanceStatus);
  }

  isAtRiskChurn(): boolean {
    return this.props.status === "active" && this.props.currentStreakDays === 0 && this.props.totalClassesAttended > 0;
  }

  isVip(): boolean {
    return this.props.loyaltyPoints >= 5000 || this.props.totalClassesAttended >= 100;
  }

  activate(): StudentProfile {
    return new StudentProfile({ ...this.props, status: "active", updatedAt: new Date() });
  }

  hold(note?: string): StudentProfile {
    return new StudentProfile({ ...this.props, status: "on_hold", notes: note ?? this.props.notes, updatedAt: new Date() });
  }

  drop(): StudentProfile {
    return new StudentProfile({ ...this.props, status: "dropped", updatedAt: new Date() });
  }

  graduate(): StudentProfile {
    return new StudentProfile({ ...this.props, status: "alumni", updatedAt: new Date() });
  }

  addLoyaltyPoints(points: number): StudentProfile {
    if (points < 0) throw new Error("Points must be positive");
    return new StudentProfile({ ...this.props, loyaltyPoints: this.props.loyaltyPoints + points, updatedAt: new Date() });
  }

  linkFrappe(frappeStudentId: string): StudentProfile {
    return new StudentProfile({ ...this.props, frappeStudentId, updatedAt: new Date() });
  }

  linkChatwoot(chatwootContactId: string): StudentProfile {
    return new StudentProfile({ ...this.props, chatwootContactId, updatedAt: new Date() });
  }

  linkErpnext(erpnextCustomerId: string): StudentProfile {
    return new StudentProfile({ ...this.props, erpnextCustomerId, updatedAt: new Date() });
  }

  toJSON(): StudentProfileProps {
    return {
      ...this.props,
      yogaGoals: [...this.props.yogaGoals],
      guardians: this.props.guardians.map(g => ({ ...g })),
    };
  }
}

// Enrollment number generator format: SY-YYYY-NNNN
export function generateEnrollmentNumber(year: number, sequence: number): string {
  return `SY-${year}-${String(sequence).padStart(4, "0")}`;
}
