import { McpServerManifest, McpTool } from './types';

const TOOLS: McpTool[] = [
  {
    name: 'get_teacher_profile',
    description: "Retrieve a teacher's public profile: bio, specialties, certifications, and rating.",
    tier: 'staff', riskLevel: 1,
    inputSchema: { type: 'object', required: ['teacherId'],
      properties: { teacherId: { type: 'string' } },
    },
  },
  {
    name: 'get_teacher_availability',
    description: "Return a teacher's available time slots for a given date range.",
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['teacherId'],
      properties: {
        teacherId: { type: 'string' },
        dateFrom:  { type: 'string', format: 'date' },
        dateTo:    { type: 'string', format: 'date' },
      },
    },
  },
  {
    name: 'update_teacher_availability',
    description: 'Update the availability schedule for a teacher (teacher or admin only).',
    tier: 'staff', riskLevel: 2,
    inputSchema: { type: 'object', required: ['teacherId', 'slots'],
      properties: {
        teacherId: { type: 'string' },
        slots: { type: 'array', items: { type: 'object', properties: {
          dayOfWeek: { type: 'string' }, startTime: { type: 'string' }, endTime: { type: 'string' },
        }}},
      },
    },
    safetyNote: 'Updating availability may affect already-scheduled classes — check for conflicts first',
  },
  {
    name: 'get_certifications',
    description: "List a teacher's certifications, issuing body, issue dates, and expiry dates.",
    tier: 'staff', riskLevel: 1,
    inputSchema: { type: 'object', required: ['teacherId'],
      properties: { teacherId: { type: 'string' } },
    },
  },
  {
    name: 'assign_class',
    description: 'Assign or reassign a class to a teacher. Requires admin approval.',
    tier: 'admin', riskLevel: 3,
    inputSchema: { type: 'object', required: ['classId', 'teacherId', 'adminId', 'reason'],
      properties: {
        classId:   { type: 'string' },
        teacherId: { type: 'string' },
        adminId:   { type: 'string' },
        reason:    { type: 'string' },
        notifyStudents: { type: 'boolean', default: true },
      },
    },
    safetyNote: 'Reassigning a class with enrolled students triggers automatic student notification',
    tags: ['requires_approval'],
  },
  {
    name: 'get_teacher_performance',
    description: 'Retrieve class ratings, student retention, and attendance-fill metrics for a teacher.',
    tier: 'staff', riskLevel: 2,
    inputSchema: { type: 'object', required: ['teacherId'],
      properties: {
        teacherId:  { type: 'string' },
        periodDays: { type: 'number', default: 90 },
      },
    },
    safetyNote: 'Performance data is confidential — accessible to admin and the teacher themselves only',
  },
  {
    name: 'send_teacher_notification',
    description: 'Send a scheduled class reminder or administrative notice to a teacher.',
    tier: 'staff', riskLevel: 1,
    inputSchema: { type: 'object', required: ['teacherId', 'subject', 'body'],
      properties: {
        teacherId: { type: 'string' },
        subject:   { type: 'string' },
        body:      { type: 'string' },
        channel:   { type: 'string', enum: ['email','sms','push'], default: 'email' },
      },
    },
  },
  {
    name: 'request_substitute',
    description: 'Request a substitute teacher for a class. Notifies eligible available teachers.',
    tier: 'staff', riskLevel: 2,
    inputSchema: { type: 'object', required: ['classId', 'reason'],
      properties: {
        classId: { type: 'string' },
        reason:  { type: 'string' },
        urgency: { type: 'string', enum: ['low','normal','urgent'], default: 'normal' },
      },
    },
  },
];

export const TEACHER_MCP: McpServerManifest = {
  id:          'teacher-mcp',
  slug:        'teacher-mcp',
  name:        'Teacher MCP',
  description: 'Teacher profile, availability, certification management, class assignment, and performance metrics.',
  version:     '1.0.0',
  tools:       TOOLS,
  backingServices: ['Frappe Education', 'Frappe HRMS', 'Cal.com', 'Novu'],
  availability: 'custom',
  implementationNote: 'Frappe Education REST API is the primary backing store. Build custom MCP with strict read-default, write-requires-approval policy.',
};
