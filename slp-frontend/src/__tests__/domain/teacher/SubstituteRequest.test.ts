import { SubstituteRequest } from "@/domain/teacher/SubstituteRequest";

const base = {
  id: "sr1",
  classId: "cls1",
  className: "Morning Hatha Flow",
  classDate: new Date("2026-09-15T09:00:00Z"),
  originalTeacherId: "t1",
  originalTeacherName: "Sunita Patel",
  status: "requested" as const,
  reason: "Family emergency",
  requestedAt: new Date(),
  notes: "",
  updatedAt: new Date(),
};

describe("SubstituteRequest", () => {
  it("creates valid substitute request", () => {
    const s = new SubstituteRequest(base);
    expect(s.status).toBe("requested");
    expect(s.reason).toBe("Family emergency");
  });

  it("throws on empty class ID", () => {
    expect(() => new SubstituteRequest({ ...base, classId: "" })).toThrow("Class ID required");
  });

  it("throws on empty reason", () => {
    expect(() => new SubstituteRequest({ ...base, reason: "  " })).toThrow("Reason required");
  });

  it("throws on empty original teacher ID", () => {
    expect(() => new SubstituteRequest({ ...base, originalTeacherId: "" })).toThrow("Original teacher ID required");
  });

  it("isPending — true for requested", () => {
    expect(new SubstituteRequest(base).isPending()).toBe(true);
  });

  it("isPending — true for approved (not yet covered)", () => {
    const s = new SubstituteRequest(base).approve("admin1");
    expect(s.isPending()).toBe(true);
  });

  it("isPending — false for covered", () => {
    const s = new SubstituteRequest(base)
      .approve("admin1")
      .assignSubstitute("t2", "Priya Sharma")
      .cover();
    expect(s.isPending()).toBe(false);
  });

  it("isResolved — false for requested", () => {
    expect(new SubstituteRequest(base).isResolved()).toBe(false);
  });

  it("isResolved — true for rejected", () => {
    const s = new SubstituteRequest(base).reject("No substitute available");
    expect(s.isResolved()).toBe(true);
  });

  it("hasSubstitute — false initially", () => {
    expect(new SubstituteRequest(base).hasSubstitute()).toBe(false);
  });

  // --- State machine ---
  it("approve — requested → approved", () => {
    const s = new SubstituteRequest(base).approve("admin1");
    expect(s.status).toBe("approved");
    expect(s.approvedBy).toBe("admin1");
  });

  it("approve — throws if not requested", () => {
    const s = new SubstituteRequest(base).approve("admin1");
    expect(() => s.approve("admin2")).toThrow("Can only approve a requested substitute");
  });

  it("approve — throws on empty approver", () => {
    expect(() => new SubstituteRequest(base).approve("  ")).toThrow("Approver ID required");
  });

  it("reject — requires reason", () => {
    expect(() => new SubstituteRequest(base).reject("")).toThrow("Rejection reason required");
  });

  it("reject — requested → rejected", () => {
    const s = new SubstituteRequest(base).reject("No sub available");
    expect(s.status).toBe("rejected");
    expect(s.rejectReason).toBe("No sub available");
  });

  it("reject — throws if not requested", () => {
    const s = new SubstituteRequest(base).approve("admin1");
    expect(() => s.reject("reason")).toThrow("Can only reject a requested substitute");
  });

  it("assignSubstitute — sets sub on approved", () => {
    const s = new SubstituteRequest(base).approve("admin1").assignSubstitute("t2", "Priya Sharma");
    expect(s.substituteTeacherId).toBe("t2");
    expect(s.hasSubstitute()).toBe(true);
  });

  it("assignSubstitute — throws if not approved", () => {
    expect(() => new SubstituteRequest(base).assignSubstitute("t2", "Priya")).toThrow("Can only assign substitute to approved request");
  });

  it("cover — approved → covered", () => {
    const s = new SubstituteRequest(base)
      .approve("admin1")
      .assignSubstitute("t2", "Priya Sharma")
      .cover();
    expect(s.status).toBe("covered");
  });

  it("cover — throws without assigned substitute", () => {
    const s = new SubstituteRequest(base).approve("admin1");
    expect(() => s.cover()).toThrow("No substitute assigned");
  });

  it("miss — approved → missed", () => {
    const s = new SubstituteRequest(base).approve("admin1").miss();
    expect(s.status).toBe("missed");
  });

  it("cancel — requires reason", () => {
    expect(() => new SubstituteRequest(base).cancel("")).toThrow("Cancellation reason required");
  });

  it("cancel — requested → cancelled", () => {
    const s = new SubstituteRequest(base).cancel("Teacher recovered");
    expect(s.status).toBe("cancelled");
    expect(s.cancellationReason).toBe("Teacher recovered");
  });

  it("cancel — throws from covered state", () => {
    const s = new SubstituteRequest(base)
      .approve("admin1")
      .assignSubstitute("t2", "Priya Sharma")
      .cover();
    expect(() => s.cancel("reason")).toThrow("Cannot cancel in current state");
  });

  it("immutable — approve does not modify original", () => {
    const s = new SubstituteRequest(base);
    s.approve("admin1");
    expect(s.status).toBe("requested");
  });
});
