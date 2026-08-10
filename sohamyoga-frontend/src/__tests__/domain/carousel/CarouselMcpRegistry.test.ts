import {
  CarouselMcpRegistry,
  CAROUSEL_MCP_TOOLS,
  CarouselMcpExecuteRequest,
} from "../../../domain/carousel/CarouselMcpRegistry";

describe("CarouselMcpRegistry — tool catalogue", () => {
  it("exposes exactly 12 tools", () => {
    expect(CAROUSEL_MCP_TOOLS).toHaveLength(12);
  });

  it("getTools returns copy, not reference", () => {
    const tools = CarouselMcpRegistry.getTools();
    tools.push({ name: "injected", description: "bad", tier: "auto", requiredFields: [] });
    expect(CarouselMcpRegistry.getTools()).toHaveLength(12);
  });

  it("getTool returns correct tool", () => {
    expect(CarouselMcpRegistry.getTool("list_carousels")?.tier).toBe("auto");
  });

  it("getTool returns undefined for unknown", () => {
    expect(CarouselMcpRegistry.getTool("nonexistent")).toBeUndefined();
  });

  const AUTO_TOOLS = ["list_carousels", "get_carousel"];
  const STAFF_TOOLS = ["create_carousel", "update_carousel", "add_slide", "update_slide", "reorder_slides", "get_analytics", "schedule_slide"];
  const STAFF_APPROVAL_TOOLS = ["publish_carousel", "archive_carousel"];
  const ADMIN_DESTRUCTIVE_TOOLS = ["delete_carousel"];

  it.each(AUTO_TOOLS)("auto tier: %s", (name) => {
    expect(CarouselMcpRegistry.getTool(name)?.tier).toBe("auto");
  });

  it.each(STAFF_TOOLS)("staff tier: %s", (name) => {
    expect(CarouselMcpRegistry.getTool(name)?.tier).toBe("staff");
  });

  it.each(STAFF_APPROVAL_TOOLS)("staff_approval tier: %s", (name) => {
    expect(CarouselMcpRegistry.getTool(name)?.tier).toBe("staff_approval");
  });

  it.each(ADMIN_DESTRUCTIVE_TOOLS)("admin_destructive tier: %s", (name) => {
    expect(CarouselMcpRegistry.getTool(name)?.tier).toBe("admin_destructive");
  });
});

describe("CarouselMcpRegistry — auto tier", () => {
  it("list_carousels allowed with no args", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "list_carousels", args: {} })).toEqual({ allowed: true });
  });

  it("get_carousel requires carouselId", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "get_carousel", args: {} }).allowed).toBe(false);
  });

  it("get_carousel allowed with carouselId", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "get_carousel", args: { carouselId: "cr-1" } })).toEqual({ allowed: true });
  });
});

describe("CarouselMcpRegistry — staff tier", () => {
  it("create_carousel requires name, location, createdBy", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "create_carousel", args: { name: "Hero" } }).allowed).toBe(false);
  });

  it("create_carousel allowed with all fields", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "create_carousel", args: { name: "Hero", location: "hero", createdBy: "u-1" } })).toEqual({ allowed: true });
  });

  it("update_carousel requires carouselId and updatedBy", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "update_carousel", args: { carouselId: "cr-1" } }).allowed).toBe(false);
  });

  it("update_carousel allowed", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "update_carousel", args: { carouselId: "cr-1", updatedBy: "u-1" } })).toEqual({ allowed: true });
  });

  it("add_slide requires carouselId, type, src, createdBy", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "add_slide", args: { carouselId: "cr-1", type: "image" } }).allowed).toBe(false);
  });

  it("add_slide allowed with all fields", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "add_slide", args: { carouselId: "cr-1", type: "image", src: "/img.jpg", createdBy: "u-1" } })).toEqual({ allowed: true });
  });

  it("update_slide requires slideId and updatedBy", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "update_slide", args: { slideId: "sl-1" } }).allowed).toBe(false);
  });

  it("reorder_slides requires carouselId and orderedSlideIds", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "reorder_slides", args: { carouselId: "cr-1" } }).allowed).toBe(false);
  });

  it("reorder_slides allowed", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "reorder_slides", args: { carouselId: "cr-1", orderedSlideIds: ["sl-1", "sl-2"] } })).toEqual({ allowed: true });
  });

  it("get_analytics requires carouselId", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "get_analytics", args: {} }).allowed).toBe(false);
  });

  it("schedule_slide requires slideId, activeFrom, activeTo", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "schedule_slide", args: { slideId: "sl-1" } }).allowed).toBe(false);
  });

  it("schedule_slide allowed", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "schedule_slide", args: { slideId: "sl-1", activeFrom: "2027-01-01", activeTo: "2027-02-01" } })).toEqual({ allowed: true });
  });
});

describe("CarouselMcpRegistry — staff_approval tier", () => {
  it("publish_carousel blocked without confirmApprovalId", () => {
    const result = CarouselMcpRegistry.canExecute({ toolName: "publish_carousel", args: { carouselId: "cr-1", publishedBy: "u-1" } });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("confirmApprovalId");
  });

  it("publish_carousel allowed with confirmApprovalId", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "publish_carousel", args: { carouselId: "cr-1", publishedBy: "u-1" }, confirmApprovalId: "appr-1" })).toEqual({ allowed: true });
  });

  it("archive_carousel blocked without confirmApprovalId", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "archive_carousel", args: { carouselId: "cr-1", archivedBy: "u-1" } }).allowed).toBe(false);
  });

  it("archive_carousel allowed with confirmApprovalId", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "archive_carousel", args: { carouselId: "cr-1", archivedBy: "u-1" }, confirmApprovalId: "appr-2" })).toEqual({ allowed: true });
  });

  it("blocked when required field missing even with approval", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "publish_carousel", args: { carouselId: "cr-1" }, confirmApprovalId: "appr-1" }).allowed).toBe(false);
  });
});

describe("CarouselMcpRegistry — admin_destructive", () => {
  const req = (overrides: Partial<CarouselMcpExecuteRequest> = {}): CarouselMcpExecuteRequest => ({
    toolName: "delete_carousel",
    args: { carouselId: "cr-1", deletedBy: "admin-1" },
    ...overrides,
  });

  it("blocked without any confirm", () => {
    expect(CarouselMcpRegistry.canExecute(req()).allowed).toBe(false);
  });

  it("blocked with only confirmText", () => {
    expect(CarouselMcpRegistry.canExecute(req({ confirmText: "DELETE_CAROUSEL" })).allowed).toBe(false);
  });

  it("blocked with only confirmApprovalId", () => {
    expect(CarouselMcpRegistry.canExecute(req({ confirmApprovalId: "appr-99" })).allowed).toBe(false);
  });

  it("blocked with wrong confirmText", () => {
    expect(CarouselMcpRegistry.canExecute(req({ confirmText: "delete", confirmApprovalId: "appr-99" })).allowed).toBe(false);
  });

  it("allowed with both correct confirmText and confirmApprovalId", () => {
    expect(CarouselMcpRegistry.canExecute(req({ confirmText: "DELETE_CAROUSEL", confirmApprovalId: "appr-99" }))).toEqual({ allowed: true });
  });

  it("blocked when required field missing even with both confirms", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "delete_carousel", args: { carouselId: "cr-1" }, confirmText: "DELETE_CAROUSEL", confirmApprovalId: "appr-99" }).allowed).toBe(false);
  });
});

describe("CarouselMcpRegistry — unknown tool", () => {
  it("returns not allowed", () => {
    const result = CarouselMcpRegistry.canExecute({ toolName: "hack_carousel", args: {} });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Unknown tool");
  });
});

describe("CarouselMcpRegistry — required field edge cases", () => {
  it("blocks when required field is null", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "get_carousel", args: { carouselId: null } }).allowed).toBe(false);
  });

  it("blocks when required field is empty string", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "get_carousel", args: { carouselId: "" } }).allowed).toBe(false);
  });

  it("blocks when required field is undefined", () => {
    expect(CarouselMcpRegistry.canExecute({ toolName: "get_carousel", args: { carouselId: undefined } }).allowed).toBe(false);
  });
});
