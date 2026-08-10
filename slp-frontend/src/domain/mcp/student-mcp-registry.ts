/**
 * Student MCP — 10 tools wrapping Frappe Education (enrollment, attendance, fees),
 * Formbricks (health intake + goals survey), and Chatwoot (student support).
 * Core student ops live in Frappe Education; financial ops are in customer-mcp (ERPNext).
 * Health questionnaire data stays local — never sent to cloud models without consent.
 */
import { McpServerManifest, McpTool } from './types';

const TOOLS: McpTool[] = [
  {
    name: 'get_student_profile',
    description: 'Retrieve a student profile: personal info, enrollment status, linked Frappe/ERPNext/Chatwoot IDs, and progress snapshot.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['studentId'],
      properties: {
        studentId:         { type: 'string' },
        includeHealthData: { type: 'boolean', default: false, description: 'Health data requires explicit consent — default false' },
      },
    },
    safetyNote: 'Never return health questionnaire responses unless includeHealthData=true AND student consent is confirmed',
  },
  {
    name: 'list_enrollments',
    description: 'List all course enrollments for a student: course name, instructor, status, fee status, and attendance rate.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['studentId'],
      properties: {
        studentId: { type: 'string' },
        status:    { type: 'string', enum: ['active','completed','dropped','all'], default: 'active' },
      },
    },
  },
  {
    name: 'enroll_in_course',
    description: 'Enroll a student in a course via Frappe Education. Creates enrollment record and fee entry in ERPNext.',
    tier: 'staff', riskLevel: 2,
    inputSchema: { type: 'object', required: ['studentId', 'courseId', 'startDate'],
      properties: {
        studentId:    { type: 'string' },
        courseId:     { type: 'string' },
        startDate:    { type: 'string', format: 'date' },
        feeWaived:    { type: 'boolean', default: false },
        waiverReason: { type: 'string' },
      },
    },
    safetyNote: 'Verify student health clearance before enrolling in physically demanding courses',
  },
  {
    name: 'get_attendance_report',
    description: 'Return attendance history for a student: per-class attended/absent/excused, attendance rate, and trend.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['studentId'],
      properties: {
        studentId:  { type: 'string' },
        courseId:   { type: 'string', description: 'Filter to one course (omit for all)' },
        fromDate:   { type: 'string', format: 'date' },
        toDate:     { type: 'string', format: 'date' },
      },
    },
  },
  {
    name: 'get_fee_schedule',
    description: 'Return fee schedule, amount paid, outstanding balance, and payment due dates for a student.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['studentId'],
      properties: { studentId: { type: 'string' } },
    },
    safetyNote: 'Financial data — restrict to student, reception, and finance roles',
  },
  {
    name: 'submit_intake_form',
    description: 'Trigger a Formbricks health intake or yoga-goals survey and record the response. Student must consent.',
    tier: 'customer_confirm', riskLevel: 2,
    inputSchema: { type: 'object', required: ['studentId', 'formType'],
      properties: {
        studentId:     { type: 'string' },
        formType:      { type: 'string', enum: ['health_intake','yoga_goals','satisfaction_nps','post_class_feedback','injury_declaration'] },
        deliveryMethod:{ type: 'string', enum: ['in_app','email','link'], default: 'in_app' },
      },
    },
    safetyNote: 'Health intake responses are stored locally and never sent to external AI models without explicit HIPAA/PIPEDA consent',
  },
  {
    name: 'get_survey_response',
    description: 'Retrieve a completed Formbricks survey response for a student.',
    tier: 'staff', riskLevel: 2,
    inputSchema: { type: 'object', required: ['studentId', 'formType'],
      properties: {
        studentId: { type: 'string' },
        formType:  { type: 'string' },
        latest:    { type: 'boolean', default: true },
      },
    },
    safetyNote: 'Health questionnaire data — requires explicit student consent before sharing with any third party or AI model',
  },
  {
    name: 'get_student_dashboard',
    description: 'Return a composite student dashboard: practice streak, achievements, next class, current goals, and outstanding fees.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['studentId'],
      properties: { studentId: { type: 'string' } },
    },
  },
  {
    name: 'open_support_ticket',
    description: 'Create a Chatwoot support conversation for a student (billing query, class change request, complaint).',
    tier: 'staff', riskLevel: 2,
    inputSchema: { type: 'object', required: ['studentId', 'subject', 'category'],
      properties: {
        studentId: { type: 'string' },
        subject:   { type: 'string' },
        category:  { type: 'string', enum: ['billing','class_change','complaint','health_concern','general'] },
        priority:  { type: 'string', enum: ['low','medium','high','urgent'], default: 'medium' },
        body:      { type: 'string' },
      },
    },
  },
  {
    name: 'get_student_support_history',
    description: 'Retrieve Chatwoot conversation history for a student: tickets, messages, and resolution status.',
    tier: 'staff', riskLevel: 2,
    inputSchema: { type: 'object', required: ['studentId'],
      properties: {
        studentId: { type: 'string' },
        status:    { type: 'string', enum: ['open','resolved','all'], default: 'all' },
        limit:     { type: 'number', default: 10 },
      },
    },
    safetyNote: 'Conversation history may contain health concerns — restrict to staff and above',
  },
];

export const STUDENT_MCP: McpServerManifest = {
  id:          'student-mcp',
  slug:        'student-mcp',
  name:        'Student MCP',
  description: 'Student profiles, course enrollment, attendance, fee schedules, health intake forms, wellness goals, and support tickets.',
  version:     '1.0.0',
  tools:       TOOLS,
  backingServices: [
    'Frappe Education (student profiles, enrollment, attendance, fees)',
    'ERPNext (fee entries, customer record)',
    'Formbricks (health intake, goals survey, NPS, feedback)',
    'Chatwoot (support tickets, conversation history)',
  ],
  availability: 'custom',
  implementationNote: 'Build custom MCP adapter wrapping Frappe Education REST API and Chatwoot API. Formbricks exposes a REST API — wrap with rate-limiting and consent checks. Health data must never be sent to external AI models without documented student consent.',
};
