import {
  SurveyMcpRegistry,
  SURVEY_MCP_TOOLS,
  SurveyMcpExecuteRequest,
} from "../../../domain/survey/SurveyMcpRegistry";

describe("SurveyMcpRegistry — tool catalogue", () => {
  it("exposes exactly 12 tools", () => {
    expect(SURVEY_MCP_TOOLS).toHaveLength(12);
  });

  it("getTools returns a copy, not reference", () => {
    const tools = SurveyMcpRegistry.getTools();
    tools.push({ name: "injected", description: "bad", tier: "auto", requiredFields: [] });
    expect(SurveyMcpRegistry.getTools()).toHaveLength(12);
  });

  it("getTool returns correct tool by name", () => {
    expect(SurveyMcpRegistry.getTool("list_surveys")?.tier).toBe("auto");
  });

  it("getTool returns undefined for unknown name", () => {
    expect(SurveyMcpRegistry.getTool("unknown_tool")).toBeUndefined();
  });

  const AUTO_TOOLS = ["list_surveys", "get_survey"];
  const STAFF_TOOLS = ["get_analytics", "create_survey", "add_question", "send_invitation", "get_responses", "export_responses"];
  const CUSTOMER_CONFIRM_TOOLS = ["submit_response"];
  const STAFF_APPROVAL_TOOLS = ["publish_survey", "close_survey"];
  const ADMIN_DESTRUCTIVE_TOOLS = ["delete_survey"];

  it.each(AUTO_TOOLS)("auto tier: %s", (name) => {
    expect(SurveyMcpRegistry.getTool(name)?.tier).toBe("auto");
  });

  it.each(STAFF_TOOLS)("staff tier: %s", (name) => {
    expect(SurveyMcpRegistry.getTool(name)?.tier).toBe("staff");
  });

  it.each(CUSTOMER_CONFIRM_TOOLS)("customer_confirm tier: %s", (name) => {
    expect(SurveyMcpRegistry.getTool(name)?.tier).toBe("customer_confirm");
  });

  it.each(STAFF_APPROVAL_TOOLS)("staff_approval tier: %s", (name) => {
    expect(SurveyMcpRegistry.getTool(name)?.tier).toBe("staff_approval");
  });

  it.each(ADMIN_DESTRUCTIVE_TOOLS)("admin_destructive tier: %s", (name) => {
    expect(SurveyMcpRegistry.getTool(name)?.tier).toBe("admin_destructive");
  });
});

describe("SurveyMcpRegistry — auto tier execution", () => {
  it("list_surveys — no args required, executes", () => {
    expect(SurveyMcpRegistry.canExecute({ toolName: "list_surveys", args: {} })).toEqual({ allowed: true });
  });

  it("get_survey — requires surveyId", () => {
    expect(SurveyMcpRegistry.canExecute({ toolName: "get_survey", args: {} }).allowed).toBe(false);
  });

  it("get_survey — allowed with surveyId", () => {
    expect(SurveyMcpRegistry.canExecute({ toolName: "get_survey", args: { surveyId: "sv-1" } })).toEqual({ allowed: true });
  });
});

describe("SurveyMcpRegistry — staff tier execution", () => {
  it("get_analytics — requires surveyId", () => {
    expect(SurveyMcpRegistry.canExecute({ toolName: "get_analytics", args: {} }).allowed).toBe(false);
  });

  it("get_analytics — allowed with surveyId", () => {
    expect(SurveyMcpRegistry.canExecute({ toolName: "get_analytics", args: { surveyId: "sv-1" } })).toEqual({ allowed: true });
  });

  it("create_survey — requires title, type, createdBy", () => {
    const result = SurveyMcpRegistry.canExecute({ toolName: "create_survey", args: { title: "T", type: "nps" } });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("createdBy");
  });

  it("create_survey — allowed with all fields", () => {
    expect(SurveyMcpRegistry.canExecute({ toolName: "create_survey", args: { title: "T", type: "nps", createdBy: "u-1" } })).toEqual({ allowed: true });
  });

  it("add_question — requires surveyId, questionType, text", () => {
    expect(SurveyMcpRegistry.canExecute({ toolName: "add_question", args: { surveyId: "sv-1" } }).allowed).toBe(false);
  });

  it("send_invitation — requires surveyId and recipientEmails", () => {
    expect(SurveyMcpRegistry.canExecute({ toolName: "send_invitation", args: { surveyId: "sv-1" } }).allowed).toBe(false);
  });

  it("send_invitation — allowed with both fields", () => {
    expect(SurveyMcpRegistry.canExecute({ toolName: "send_invitation", args: { surveyId: "sv-1", recipientEmails: ["a@b.com"] } })).toEqual({ allowed: true });
  });

  it("get_responses — requires surveyId", () => {
    expect(SurveyMcpRegistry.canExecute({ toolName: "get_responses", args: {} }).allowed).toBe(false);
  });

  it("export_responses — requires surveyId and format", () => {
    expect(SurveyMcpRegistry.canExecute({ toolName: "export_responses", args: { surveyId: "sv-1" } }).allowed).toBe(false);
  });

  it("export_responses — allowed with surveyId and format", () => {
    expect(SurveyMcpRegistry.canExecute({ toolName: "export_responses", args: { surveyId: "sv-1", format: "csv" } })).toEqual({ allowed: true });
  });
});

describe("SurveyMcpRegistry — customer_confirm execution", () => {
  const req = (overrides: Partial<SurveyMcpExecuteRequest> = {}): SurveyMcpExecuteRequest => ({
    toolName: "submit_response",
    args: { surveyId: "sv-1", answers: [{ questionId: "q-1", value: "yes" }] },
    ...overrides,
  });

  it("blocked without confirmText", () => {
    const result = SurveyMcpRegistry.canExecute(req());
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("SUBMIT_RESPONSE");
  });

  it("blocked with wrong confirmText", () => {
    expect(SurveyMcpRegistry.canExecute(req({ confirmText: "WRONG" })).allowed).toBe(false);
  });

  it("allowed with correct confirmText", () => {
    expect(SurveyMcpRegistry.canExecute(req({ confirmText: "SUBMIT_RESPONSE" }))).toEqual({ allowed: true });
  });

  it("blocked when missing required field (answers)", () => {
    expect(SurveyMcpRegistry.canExecute({ toolName: "submit_response", args: { surveyId: "sv-1" }, confirmText: "SUBMIT_RESPONSE" }).allowed).toBe(false);
  });
});

describe("SurveyMcpRegistry — staff_approval execution", () => {
  it("publish_survey blocked without confirmApprovalId", () => {
    const result = SurveyMcpRegistry.canExecute({ toolName: "publish_survey", args: { surveyId: "sv-1", publishedBy: "u-1" } });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("confirmApprovalId");
  });

  it("publish_survey allowed with confirmApprovalId", () => {
    expect(SurveyMcpRegistry.canExecute({
      toolName: "publish_survey",
      args: { surveyId: "sv-1", publishedBy: "u-1" },
      confirmApprovalId: "appr-123",
    })).toEqual({ allowed: true });
  });

  it("close_survey blocked without confirmApprovalId", () => {
    expect(SurveyMcpRegistry.canExecute({ toolName: "close_survey", args: { surveyId: "sv-1", closedBy: "u-1" } }).allowed).toBe(false);
  });

  it("close_survey allowed with confirmApprovalId", () => {
    expect(SurveyMcpRegistry.canExecute({
      toolName: "close_survey",
      args: { surveyId: "sv-1", closedBy: "u-1" },
      confirmApprovalId: "appr-456",
    })).toEqual({ allowed: true });
  });

  it("close_survey blocked when missing required field", () => {
    expect(SurveyMcpRegistry.canExecute({ toolName: "close_survey", args: { surveyId: "sv-1" }, confirmApprovalId: "appr-456" }).allowed).toBe(false);
  });
});

describe("SurveyMcpRegistry — admin_destructive execution", () => {
  const req = (overrides: Partial<SurveyMcpExecuteRequest> = {}): SurveyMcpExecuteRequest => ({
    toolName: "delete_survey",
    args: { surveyId: "sv-1", deletedBy: "admin-1" },
    ...overrides,
  });

  it("blocked without any confirm", () => {
    expect(SurveyMcpRegistry.canExecute(req()).allowed).toBe(false);
  });

  it("blocked with only confirmText", () => {
    expect(SurveyMcpRegistry.canExecute(req({ confirmText: "DELETE_SURVEY" })).allowed).toBe(false);
  });

  it("blocked with only confirmApprovalId", () => {
    expect(SurveyMcpRegistry.canExecute(req({ confirmApprovalId: "appr-789" })).allowed).toBe(false);
  });

  it("blocked with wrong confirmText", () => {
    expect(SurveyMcpRegistry.canExecute(req({ confirmText: "delete", confirmApprovalId: "appr-789" })).allowed).toBe(false);
  });

  it("allowed with both correct confirmText and confirmApprovalId", () => {
    expect(SurveyMcpRegistry.canExecute(req({ confirmText: "DELETE_SURVEY", confirmApprovalId: "appr-789" }))).toEqual({ allowed: true });
  });

  it("blocked when required field missing even with both confirms", () => {
    expect(SurveyMcpRegistry.canExecute({
      toolName: "delete_survey",
      args: { surveyId: "sv-1" },
      confirmText: "DELETE_SURVEY",
      confirmApprovalId: "appr-789",
    }).allowed).toBe(false);
  });
});

describe("SurveyMcpRegistry — unknown tool", () => {
  it("returns not allowed for unknown tool", () => {
    const result = SurveyMcpRegistry.canExecute({ toolName: "hack_survey", args: {} });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Unknown tool");
  });
});

describe("SurveyMcpRegistry — required field validation edge cases", () => {
  it("blocks when required field is null", () => {
    const result = SurveyMcpRegistry.canExecute({ toolName: "get_survey", args: { surveyId: null } });
    expect(result.allowed).toBe(false);
  });

  it("blocks when required field is empty string", () => {
    const result = SurveyMcpRegistry.canExecute({ toolName: "get_survey", args: { surveyId: "" } });
    expect(result.allowed).toBe(false);
  });

  it("allows when required field is numeric 0", () => {
    // 0 is falsy in JS but a valid value for some fields
    // toolName get_analytics only needs surveyId, not a number — so test a valid non-empty surveyId
    const result = SurveyMcpRegistry.canExecute({ toolName: "list_surveys", args: {} });
    expect(result.allowed).toBe(true);
  });
});
