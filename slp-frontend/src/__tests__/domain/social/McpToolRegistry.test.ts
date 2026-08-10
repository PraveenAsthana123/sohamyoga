import { MCP_TOOLS, getMcpTool } from "@/domain/social/McpToolRegistry";

describe("McpToolRegistry", () => {
  it("has exactly 15 tools", () => {
    expect(MCP_TOOLS).toHaveLength(15);
  });

  it("all tool names are unique", () => {
    const names = MCP_TOOLS.map(t => t.name);
    expect(new Set(names).size).toBe(15);
  });

  it("all tools have descriptions", () => {
    MCP_TOOLS.forEach(t => expect(t.description.length).toBeGreaterThan(10));
  });

  it("all tools have input schema", () => {
    MCP_TOOLS.forEach(t => expect(t.inputSchema).toBeDefined());
  });

  // Governance: destructive tools require approval
  it("publish_post is destructive and requires approval", () => {
    const t = getMcpTool("publish_post")!;
    expect(t.isDestructive).toBe(true);
    expect(t.requiresApproval).toBe(true);
  });

  it("disconnect_account is destructive and requires approval", () => {
    const t = getMcpTool("disconnect_account")!;
    expect(t.isDestructive).toBe(true);
    expect(t.requiresApproval).toBe(true);
  });

  it("draft_reply requires approval (not autonomously sent)", () => {
    const t = getMcpTool("draft_reply")!;
    expect(t.requiresApproval).toBe(true);
  });

  it("schedule_post requires approval", () => {
    const t = getMcpTool("schedule_post")!;
    expect(t.requiresApproval).toBe(true);
  });

  // Read-only tools should NOT require approval
  it("list_social_accounts does not require approval", () => {
    const t = getMcpTool("list_social_accounts")!;
    expect(t.requiresApproval).toBe(false);
    expect(t.isDestructive).toBe(false);
  });

  it("read_analytics does not require approval", () => {
    const t = getMcpTool("read_analytics")!;
    expect(t.requiresApproval).toBe(false);
    expect(t.isDestructive).toBe(false);
  });

  it("read_comments is read-only", () => {
    const t = getMcpTool("read_comments")!;
    expect(t.isDestructive).toBe(false);
  });

  it("create_content_draft is NOT destructive", () => {
    const t = getMcpTool("create_content_draft")!;
    expect(t.isDestructive).toBe(false);
  });

  it("publish_post input schema requires confirmApprovalId", () => {
    const t = getMcpTool("publish_post")!;
    const req = (t.inputSchema as any).required as string[];
    expect(req).toContain("confirmApprovalId");
  });

  it("disconnect_account input schema requires confirmText", () => {
    const t = getMcpTool("disconnect_account")!;
    const req = (t.inputSchema as any).required as string[];
    expect(req).toContain("confirmText");
  });

  it("getMcpTool — returns undefined for unknown name", () => {
    expect(getMcpTool("nonexistent" as any)).toBeUndefined();
  });

  it("getMcpTool — finds pause_campaign", () => {
    expect(getMcpTool("pause_campaign")).toBeDefined();
  });

  // Count destructive tools
  it("only 2 tools are destructive", () => {
    const destructive = MCP_TOOLS.filter(t => t.isDestructive);
    expect(destructive.map(t => t.name)).toEqual(["publish_post", "disconnect_account"]);
  });
});
