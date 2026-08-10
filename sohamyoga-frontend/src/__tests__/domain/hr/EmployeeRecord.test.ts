import { EmployeeRecord } from "@/domain/hr/EmployeeRecord";

const base = {
  id: "e1",
  userId: "u1",
  firstName: "Sunita",
  lastName: "Patel",
  email: "sunita@sohamyoga.com",
  employeeType: "full_time" as const,
  department: "Yoga Instruction",
  designation: "Lead Teacher",
  hireDate: new Date("2022-01-15"),
  isActive: true,
  hourlyRate: 45,
  currency: "CAD",
  leaveBalances: [
    { type: "annual" as const, entitled: 15, used: 5, remaining: 10 },
    { type: "sick"   as const, entitled: 10, used: 2, remaining: 8 },
  ],
  cpd_hoursRequired: 20,
  cpd_hoursCompleted: 8,
  notes: "",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("EmployeeRecord", () => {
  it("creates valid record", () => {
    const e = new EmployeeRecord(base);
    expect(e.fullName).toBe("Sunita Patel");
    expect(e.isActive).toBe(true);
  });

  it("throws on empty first name", () => {
    expect(() => new EmployeeRecord({ ...base, firstName: " " })).toThrow("First name required");
  });

  it("throws on invalid email", () => {
    expect(() => new EmployeeRecord({ ...base, email: "bad" })).toThrow("Invalid email");
  });

  it("throws on negative hourly rate", () => {
    expect(() => new EmployeeRecord({ ...base, hourlyRate: -1 })).toThrow("Hourly rate cannot be negative");
  });

  it("leaveBalance — returns correct balance", () => {
    const e = new EmployeeRecord(base);
    expect(e.leaveBalance("annual")?.remaining).toBe(10);
  });

  it("leaveBalance — undefined for missing type", () => {
    expect(new EmployeeRecord(base).leaveBalance("study")).toBeUndefined();
  });

  it("annualLeaveRemaining — correct value", () => {
    expect(new EmployeeRecord(base).annualLeaveRemaining()).toBe(10);
  });

  it("cpd_progress — correct percentage", () => {
    expect(new EmployeeRecord(base).cpd_progress()).toBe(40); // 8/20
  });

  it("cpd_progress — 100% when requirement met", () => {
    const e = new EmployeeRecord({ ...base, cpd_hoursCompleted: 20 });
    expect(e.cpd_progress()).toBe(100);
  });

  it("cpd_progress — 100% when no requirement", () => {
    const e = new EmployeeRecord({ ...base, cpd_hoursRequired: 0 });
    expect(e.cpd_progress()).toBe(100);
  });

  it("cpd_shortfall — correct when behind", () => {
    expect(new EmployeeRecord(base).cpd_shortfall()).toBe(12); // 20-8
  });

  it("cpd_shortfall — 0 when met", () => {
    const e = new EmployeeRecord({ ...base, cpd_hoursCompleted: 25 });
    expect(e.cpd_shortfall()).toBe(0);
  });

  it("addCpdHours — increments completed hours", () => {
    const e = new EmployeeRecord(base).addCpdHours(4);
    expect(e.cpd_hoursCompleted).toBe(12);
  });

  it("addCpdHours — throws on non-positive", () => {
    expect(() => new EmployeeRecord(base).addCpdHours(0)).toThrow("CPD hours must be positive");
  });

  it("needsAppraisal — false when no next date", () => {
    expect(new EmployeeRecord(base).needsAppraisal()).toBe(false);
  });

  it("needsAppraisal — true when past due", () => {
    const past = new Date(Date.now() - 86400000);
    const e = new EmployeeRecord({ ...base, nextAppraisalDate: past });
    expect(e.needsAppraisal()).toBe(true);
  });

  it("terminate — sets inactive and endDate", () => {
    const e = new EmployeeRecord(base).terminate(new Date());
    expect(e.isActive).toBe(false);
  });

  it("returns defensive copy of leaveBalances", () => {
    const e = new EmployeeRecord(base);
    const lb = e.leaveBalances;
    lb.push({ type: "study", entitled: 5, used: 0, remaining: 5 });
    expect(e.leaveBalances).toHaveLength(2);
  });

  it("immutable — addCpdHours does not modify original", () => {
    const e = new EmployeeRecord(base);
    e.addCpdHours(10);
    expect(e.cpd_hoursCompleted).toBe(8);
  });
});
