// Employee record — managed by Frappe HR; mirrored here for portal display
// Covers: payroll, leave, CPD tracking, appraisals

export type EmployeeType = "full_time" | "part_time" | "contractor" | "intern" | "volunteer";
export type LeaveType = "annual" | "sick" | "maternity" | "paternity" | "unpaid" | "study" | "bereavement";

export interface LeaveBalance {
  type: LeaveType;
  entitled: number;
  used: number;
  remaining: number;
}

export interface PayrollSummary {
  periodFrom: Date;
  periodTo: Date;
  grossPay: number;
  deductions: number;
  netPay: number;
  currency: string;
  erpnextPayslipId: string;
  paidAt?: Date;
}

export interface EmployeeRecordProps {
  id: string;
  userId: string;
  frappeEmployeeId?: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeType: EmployeeType;
  department: string;
  designation: string;
  reportingTo?: string;         // manager userId
  hireDate: Date;
  endDate?: Date;
  isActive: boolean;
  hourlyRate: number;
  currency: string;
  leaveBalances: LeaveBalance[];
  recentPayroll?: PayrollSummary;
  cpd_hoursRequired: number;    // Continuing Professional Development hours/year
  cpd_hoursCompleted: number;
  lastAppraisalDate?: Date;
  nextAppraisalDate?: Date;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export class EmployeeRecord {
  constructor(private props: EmployeeRecordProps) {
    if (!props.firstName.trim()) throw new Error("First name required");
    if (!props.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) throw new Error("Invalid email");
    if (props.hourlyRate < 0) throw new Error("Hourly rate cannot be negative");
    if (props.cpd_hoursRequired < 0) throw new Error("CPD hours cannot be negative");
  }

  get id()                 { return this.props.id; }
  get fullName()           { return `${this.props.firstName} ${this.props.lastName}`; }
  get email()              { return this.props.email; }
  get frappeEmployeeId()   { return this.props.frappeEmployeeId; }
  get department()         { return this.props.department; }
  get designation()        { return this.props.designation; }
  get employeeType()       { return this.props.employeeType; }
  get isActive()           { return this.props.isActive; }
  get hourlyRate()         { return this.props.hourlyRate; }
  get leaveBalances()      { return this.props.leaveBalances.map(l => ({ ...l })); }
  get cpd_hoursRequired()  { return this.props.cpd_hoursRequired; }
  get cpd_hoursCompleted() { return this.props.cpd_hoursCompleted; }

  leaveBalance(type: LeaveType): LeaveBalance | undefined {
    return this.props.leaveBalances.find(l => l.type === type);
  }

  annualLeaveRemaining(): number {
    return this.leaveBalance("annual")?.remaining ?? 0;
  }

  cpd_progress(): number {
    if (this.props.cpd_hoursRequired === 0) return 100;
    return Math.min(100, Math.round((this.props.cpd_hoursCompleted / this.props.cpd_hoursRequired) * 100));
  }

  cpd_shortfall(): number {
    return Math.max(0, this.props.cpd_hoursRequired - this.props.cpd_hoursCompleted);
  }

  needsAppraisal(): boolean {
    if (!this.props.nextAppraisalDate) return false;
    return this.props.nextAppraisalDate <= new Date();
  }

  addCpdHours(hours: number): EmployeeRecord {
    if (hours <= 0) throw new Error("CPD hours must be positive");
    return new EmployeeRecord({ ...this.props, cpd_hoursCompleted: this.props.cpd_hoursCompleted + hours, updatedAt: new Date() });
  }

  terminate(endDate: Date): EmployeeRecord {
    return new EmployeeRecord({ ...this.props, isActive: false, endDate, updatedAt: new Date() });
  }

  toJSON(): EmployeeRecordProps {
    return {
      ...this.props,
      leaveBalances: this.props.leaveBalances.map(l => ({ ...l })),
    };
  }
}
