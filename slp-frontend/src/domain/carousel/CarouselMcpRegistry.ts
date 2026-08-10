export type CarouselAccessTier =
  | "auto"
  | "staff"
  | "staff_approval"
  | "admin_destructive";

export interface CarouselMcpTool {
  name: string;
  description: string;
  tier: CarouselAccessTier;
  requiredFields: string[];
  confirmText?: string;
  requiresApproval?: boolean;
  isDestructive?: boolean;
  safetyNote?: string;
}

export interface CarouselMcpExecuteRequest {
  toolName: string;
  args: Record<string, unknown>;
  confirmText?: string;
  confirmApprovalId?: string;
}

export interface CarouselMcpExecuteResult {
  allowed: boolean;
  reason?: string;
}

export const CAROUSEL_MCP_TOOLS: CarouselMcpTool[] = [
  {
    name: "list_carousels",
    description: "List all carousels and their current status",
    tier: "auto",
    requiredFields: [],
  },
  {
    name: "get_carousel",
    description: "Get full carousel config, settings and slide IDs",
    tier: "auto",
    requiredFields: ["carouselId"],
  },
  {
    name: "create_carousel",
    description: "Create a new carousel in draft status",
    tier: "staff",
    requiredFields: ["name", "location", "createdBy"],
  },
  {
    name: "update_carousel",
    description: "Update carousel name, location or settings",
    tier: "staff",
    requiredFields: ["carouselId", "updatedBy"],
  },
  {
    name: "add_slide",
    description: "Add a new image or video slide to a carousel",
    tier: "staff",
    requiredFields: ["carouselId", "type", "src", "createdBy"],
    safetyNote: "Videos must have muted=true and poster image set",
  },
  {
    name: "update_slide",
    description: "Update slide content, overlay or status",
    tier: "staff",
    requiredFields: ["slideId", "updatedBy"],
  },
  {
    name: "reorder_slides",
    description: "Reorder slides within a carousel",
    tier: "staff",
    requiredFields: ["carouselId", "orderedSlideIds"],
  },
  {
    name: "get_analytics",
    description: "Get carousel view and click-through analytics",
    tier: "staff",
    requiredFields: ["carouselId"],
  },
  {
    name: "schedule_slide",
    description: "Schedule a slide to activate between two dates",
    tier: "staff",
    requiredFields: ["slideId", "activeFrom", "activeTo"],
  },
  {
    name: "publish_carousel",
    description: "Publish a draft or paused carousel to make it active",
    tier: "staff_approval",
    requiresApproval: true,
    requiredFields: ["carouselId", "publishedBy"],
  },
  {
    name: "archive_carousel",
    description: "Archive an inactive carousel (removes from live portal)",
    tier: "staff_approval",
    requiresApproval: true,
    requiredFields: ["carouselId", "archivedBy"],
  },
  {
    name: "delete_carousel",
    description: "Permanently delete a carousel and all its slides",
    tier: "admin_destructive",
    isDestructive: true,
    requiresApproval: true,
    confirmText: "DELETE_CAROUSEL",
    requiredFields: ["carouselId", "deletedBy"],
    safetyNote: "Irreversible — deletes all slides, analytics and CDN assets",
  },
];

export class CarouselMcpRegistry {
  static getTools(): CarouselMcpTool[] {
    return [...CAROUSEL_MCP_TOOLS];
  }

  static getTool(name: string): CarouselMcpTool | undefined {
    return CAROUSEL_MCP_TOOLS.find(t => t.name === name);
  }

  static canExecute(request: CarouselMcpExecuteRequest): CarouselMcpExecuteResult {
    const tool = this.getTool(request.toolName);
    if (!tool) {
      return { allowed: false, reason: `Unknown tool: ${request.toolName}` };
    }

    for (const field of tool.requiredFields) {
      const val = request.args[field];
      if (val === undefined || val === null || val === "") {
        return { allowed: false, reason: `Missing required field: ${field}` };
      }
    }

    if (tool.isDestructive && tool.requiresApproval) {
      if (!request.confirmText || request.confirmText !== tool.confirmText) {
        return { allowed: false, reason: `Destructive tool requires confirmText="${tool.confirmText}"` };
      }
      if (!request.confirmApprovalId) {
        return { allowed: false, reason: "Destructive tool requires confirmApprovalId" };
      }
      return { allowed: true };
    }

    if (tool.requiresApproval) {
      if (!request.confirmApprovalId) {
        return { allowed: false, reason: "Tool requires confirmApprovalId" };
      }
      return { allowed: true };
    }

    return { allowed: true };
  }
}
