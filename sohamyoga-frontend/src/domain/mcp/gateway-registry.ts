/**
 * MCP Gateway Registry
 * Unified catalog of all 15 domain MCP servers + policy engine + tool routing.
 *
 * Architecture rule: 20-30% existing MCP servers, 50-60% wrap existing APIs,
 *                    10-20% custom yoga-specific tools.
 * Human approval required for: publish social posts, bulk email/SMS, cancel paid class,
 *                              refund, payroll, delete customer data, change pricing,
 *                              health data, medical recommendations, campaign launch.
 */

import {
  McpServerManifest,
  McpApprovalTier,
  requiresApproval,
  highRiskTools,
  getApprovalRequiredTools,
  findTool,
  countByTier,
} from './types';

import { SOCIAL_MCP       } from './social-mcp-registry';
import { BOOKING_MCP      } from './booking-mcp-registry';
import { CUSTOMER_MCP     } from './customer-mcp-registry';
import { TEACHER_MCP      } from './teacher-mcp-registry';
import { LEARNING_MCP     } from './learning-mcp-registry';
import { MARKETING_MCP    } from './marketing-mcp-registry';
import { FINANCE_MCP      } from './finance-mcp-registry';
import { CONTENT_MCP      } from './content-mcp-registry';
import { ANALYTICS_MCP    } from './analytics-mcp-registry';
import { WORKFLOW_MCP     } from './workflow-mcp-registry';
import { KNOWLEDGE_MCP    } from './knowledge-mcp-registry';
import { ADMIN_MCP        } from './admin-mcp-registry';
import { STUDENT_MCP      } from './student-mcp-registry';
import { NOTIFICATION_MCP } from './notification-mcp-registry';
import { CAMPAIGN_MCP     } from './campaign-mcp-registry';

export const ALL_MCP_SERVERS: McpServerManifest[] = [
  SOCIAL_MCP,
  BOOKING_MCP,
  CUSTOMER_MCP,
  TEACHER_MCP,
  LEARNING_MCP,
  MARKETING_MCP,
  FINANCE_MCP,
  CONTENT_MCP,
  ANALYTICS_MCP,
  WORKFLOW_MCP,
  KNOWLEDGE_MCP,
  ADMIN_MCP,
  STUDENT_MCP,
  NOTIFICATION_MCP,
  CAMPAIGN_MCP,
];

export interface ToolRoute {
  server: McpServerManifest;
  toolName: string;
  tier: McpApprovalTier;
  requiresApproval: boolean;
  riskLevel: number;
}

/** Find which server owns a given tool name. Returns undefined if not found. */
export function routeTool(toolName: string): ToolRoute | undefined {
  for (const server of ALL_MCP_SERVERS) {
    const tool = findTool(server, toolName);
    if (tool) {
      return {
        server,
        toolName,
        tier: tool.tier,
        requiresApproval: requiresApproval(tool.tier),
        riskLevel: tool.riskLevel,
      };
    }
  }
  return undefined;
}

/** Returns the approval tier for a tool call, or throws if the tool is not registered. */
export function getToolTier(toolName: string): McpApprovalTier {
  const route = routeTool(toolName);
  if (!route) throw new Error(`Unknown MCP tool: ${toolName}`);
  return route.tier;
}

export interface GatewaySummary {
  serverCount: number;
  totalTools: number;
  approvalRequiredTools: number;
  highRiskToolCount: number;
  tierBreakdown: Record<McpApprovalTier, number>;
  servers: Array<{ id: string; name: string; toolCount: number; approvalRequiredCount: number }>;
}

export function buildGatewaySummary(): GatewaySummary {
  const allTools = ALL_MCP_SERVERS.flatMap(s => s.tools);
  const tiers = countByTier(allTools);
  return {
    serverCount: ALL_MCP_SERVERS.length,
    totalTools: allTools.length,
    approvalRequiredTools: getApprovalRequiredTools(allTools).length,
    highRiskToolCount: highRiskTools(allTools, 4).length,
    tierBreakdown: tiers,
    servers: ALL_MCP_SERVERS.map(s => ({
      id:                   s.id,
      name:                 s.name,
      toolCount:            s.tools.length,
      approvalRequiredCount: getApprovalRequiredTools(s.tools).length,
    })),
  };
}

/** All tools that require human approval across all servers. */
export function getAllApprovalRequiredTools(): ToolRoute[] {
  return ALL_MCP_SERVERS.flatMap(server =>
    server.tools
      .filter(t => requiresApproval(t.tier))
      .map(t => ({
        server,
        toolName:         t.name,
        tier:             t.tier,
        requiresApproval: true,
        riskLevel:        t.riskLevel,
      }))
  );
}

/** All tools at riskLevel >= minRisk across all servers. */
export function getAllHighRiskRoutes(minRisk = 4): ToolRoute[] {
  return ALL_MCP_SERVERS.flatMap(server =>
    server.tools
      .filter(t => t.riskLevel >= minRisk)
      .map(t => ({
        server,
        toolName:         t.name,
        tier:             t.tier,
        requiresApproval: requiresApproval(t.tier),
        riskLevel:        t.riskLevel,
      }))
  );
}

/** Look up a server by its slug. */
export function getServer(slug: string): McpServerManifest | undefined {
  return ALL_MCP_SERVERS.find(s => s.slug === slug);
}

export {
  requiresApproval,
  highRiskTools,
  getApprovalRequiredTools,
  findTool,
  countByTier,
};
