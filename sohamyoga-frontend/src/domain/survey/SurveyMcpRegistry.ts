export type SurveyAccessTier =
  | "auto"
  | "customer_confirm"
  | "staff"
  | "staff_approval"
  | "admin"
  | "admin_destructive";

export interface SurveyMcpTool {
  name: string;
  description: string;
  tier: SurveyAccessTier;
  requiredFields: string[];
  confirmText?: string;
  requiresApproval?: boolean;
  isDestructive?: boolean;
  safetyNote?: string;
}

export interface SurveyMcpExecuteRequest {
  toolName: string;
  args: Record<string, unknown>;
  confirmText?: string;
  confirmApprovalId?: string;
}

export interface SurveyMcpExecuteResult {
  allowed: boolean;
  reason?: string;
}

export const SURVEY_MCP_TOOLS: SurveyMcpTool[] = [
  {
    name: "list_surveys",
    description: "List published surveys available to the respondent",
    tier: "auto",
    requiredFields: [],
  },
  {
    name: "get_survey",
    description: "Retrieve survey structure, questions and settings",
    tier: "auto",
    requiredFields: ["surveyId"],
  },
  {
    name: "get_analytics",
    description: "Retrieve aggregated analytics for a survey",
    tier: "staff",
    requiredFields: ["surveyId"],
  },
  {
    name: "create_survey",
    description: "Create a new survey in draft status",
    tier: "staff",
    requiredFields: ["title", "type", "createdBy"],
  },
  {
    name: "add_question",
    description: "Add a question to a draft or active survey",
    tier: "staff",
    requiredFields: ["surveyId", "questionType", "text"],
  },
  {
    name: "send_invitation",
    description: "Send survey invitation emails to a respondent list",
    tier: "staff",
    requiredFields: ["surveyId", "recipientEmails"],
    safetyNote: "Bulk email — rate-limited to 500 per hour via Novu",
  },
  {
    name: "get_responses",
    description: "Retrieve paginated survey responses",
    tier: "staff",
    requiredFields: ["surveyId"],
  },
  {
    name: "export_responses",
    description: "Export all responses as CSV, Excel or SPSS",
    tier: "staff",
    requiredFields: ["surveyId", "format"],
  },
  {
    name: "submit_response",
    description: "Submit a completed survey response on behalf of respondent",
    tier: "customer_confirm",
    confirmText: "SUBMIT_RESPONSE",
    requiredFields: ["surveyId", "answers"],
    safetyNote: "Cannot be undone after submission",
  },
  {
    name: "publish_survey",
    description: "Publish a draft or paused survey to make it active",
    tier: "staff_approval",
    requiresApproval: true,
    requiredFields: ["surveyId", "publishedBy"],
  },
  {
    name: "close_survey",
    description: "Close an active survey to stop accepting responses",
    tier: "staff_approval",
    requiresApproval: true,
    requiredFields: ["surveyId", "closedBy"],
  },
  {
    name: "delete_survey",
    description: "Permanently delete a survey and all its responses",
    tier: "admin_destructive",
    isDestructive: true,
    requiresApproval: true,
    confirmText: "DELETE_SURVEY",
    requiredFields: ["surveyId", "deletedBy"],
    safetyNote: "Irreversible — deletes all responses, analytics and exports",
  },
];

export class SurveyMcpRegistry {
  static getTools(): SurveyMcpTool[] {
    return [...SURVEY_MCP_TOOLS];
  }

  static getTool(name: string): SurveyMcpTool | undefined {
    return SURVEY_MCP_TOOLS.find(t => t.name === name);
  }

  static canExecute(request: SurveyMcpExecuteRequest): SurveyMcpExecuteResult {
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

    // admin_destructive: both confirmText AND confirmApprovalId
    if (tool.isDestructive && tool.requiresApproval) {
      if (!request.confirmText || request.confirmText !== tool.confirmText) {
        return { allowed: false, reason: `Destructive tool requires confirmText="${tool.confirmText}"` };
      }
      if (!request.confirmApprovalId) {
        return { allowed: false, reason: "Destructive tool requires confirmApprovalId" };
      }
      return { allowed: true };
    }

    // staff_approval: confirmApprovalId only
    if (tool.requiresApproval) {
      if (!request.confirmApprovalId) {
        return { allowed: false, reason: "Tool requires confirmApprovalId" };
      }
      return { allowed: true };
    }

    // customer_confirm: confirmText match
    if (tool.tier === "customer_confirm" && tool.confirmText) {
      if (!request.confirmText || request.confirmText !== tool.confirmText) {
        return { allowed: false, reason: `Tool requires confirmText="${tool.confirmText}"` };
      }
    }

    return { allowed: true };
  }
}
