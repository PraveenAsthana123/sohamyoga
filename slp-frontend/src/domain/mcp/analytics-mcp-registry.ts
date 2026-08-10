import { McpServerManifest, McpTool } from './types';

const TOOLS: McpTool[] = [
  {
    name: 'get_funnel_metrics',
    description: 'Return conversion funnel: visitors → leads → registrations → paying members → retained at 30/90 days.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object',
      properties: {
        periodDays:  { type: 'number', default: 30 },
        channelFilter: { type: 'string', description: 'Filter by acquisition channel' },
      },
    },
  },
  {
    name: 'get_traffic_report',
    description: 'Retrieve page views, unique visitors, top pages, and traffic source breakdown.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object',
      properties: {
        periodDays: { type: 'number', default: 30 },
        dimension:  { type: 'string', enum: ['page','channel','device','country'], default: 'page' },
        limit:      { type: 'number', default: 20 },
      },
    },
  },
  {
    name: 'get_attendance_analytics',
    description: 'Aggregate class attendance: fill rate, peak hours, no-show rate, and class-type popularity.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object',
      properties: {
        periodDays: { type: 'number', default: 30 },
        classType:  { type: 'string' },
        teacherId:  { type: 'string' },
      },
    },
  },
  {
    name: 'get_retention_metrics',
    description: 'Return member retention and churn rates, cohort analysis by join month, and at-risk member count.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object',
      properties: {
        periodDays:     { type: 'number', default: 90 },
        membershipTier: { type: 'string' },
      },
    },
  },
  {
    name: 'get_campaign_metrics',
    description: 'Retrieve email, social, and paid campaign performance: impressions, clicks, leads, and ROI.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object',
      properties: {
        campaignId:  { type: 'string', description: 'Omit to aggregate all campaigns' },
        periodDays:  { type: 'number', default: 30 },
        channel:     { type: 'string' },
      },
    },
  },
  {
    name: 'get_student_progress_metrics',
    description: 'Aggregate student course completion rates, average quiz scores, and certificate issues.',
    tier: 'staff', riskLevel: 2,
    inputSchema: { type: 'object',
      properties: {
        courseId:   { type: 'string' },
        teacherId:  { type: 'string' },
        periodDays: { type: 'number', default: 90 },
      },
    },
    safetyNote: 'Return aggregated data only. Individual student details require customer-mcp get_student_progress.',
  },
  {
    name: 'get_revenue_analytics',
    description: 'Return revenue trend, membership tier breakdown, and class-type revenue contribution.',
    tier: 'staff', riskLevel: 2,
    inputSchema: { type: 'object', required: ['periodFrom', 'periodTo'],
      properties: {
        periodFrom: { type: 'string', format: 'date' },
        periodTo:   { type: 'string', format: 'date' },
        granularity:{ type: 'string', enum: ['day','week','month'], default: 'month' },
      },
    },
    safetyNote: 'Restricted to admin and finance roles',
  },
  {
    name: 'export_analytics_report',
    description: 'Export a custom analytics report as CSV or PDF.',
    tier: 'staff', riskLevel: 2,
    inputSchema: { type: 'object', required: ['reportType', 'periodFrom', 'periodTo'],
      properties: {
        reportType: { type: 'string', enum: ['funnel','attendance','revenue','retention','campaigns'] },
        periodFrom: { type: 'string', format: 'date' },
        periodTo:   { type: 'string', format: 'date' },
        format:     { type: 'string', enum: ['csv','pdf'], default: 'csv' },
      },
    },
  },
];

export const ANALYTICS_MCP: McpServerManifest = {
  id:          'analytics-mcp',
  slug:        'analytics-mcp',
  name:        'Analytics MCP',
  description: 'Funnel conversion, traffic, attendance, retention, campaign ROI, and revenue analytics. Read-only.',
  version:     '1.0.0',
  tools:       TOOLS,
  backingServices: ['PostHog', 'Metabase', 'Langfuse (AI observability)', 'Prometheus/Grafana'],
  availability: 'custom',
  implementationNote: 'PostHog community MCP exists — review before use. Metabase has query-card community adapters. All tools are read-only; no writes to analytics backends.',
};
