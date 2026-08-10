import { McpServerManifest, McpTool } from './types';

const TOOLS: McpTool[] = [
  {
    name: 'search_courses',
    description: 'Search the yoga course catalogue by keyword, style, teacher, level, or tag.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object',
      properties: {
        query:     { type: 'string' },
        styleId:   { type: 'string' },
        teacherId: { type: 'string' },
        level:     { type: 'string' },
        format:    { type: 'string', enum: ['live','on_demand','workshop','retreat','all'], default: 'all' },
        free:      { type: 'boolean' },
        limit:     { type: 'number', default: 20 },
      },
    },
  },
  {
    name: 'enroll_student',
    description: 'Enroll a student in a course or program. Validates prerequisites and membership. Student must confirm.',
    tier: 'customer_confirm', riskLevel: 2,
    inputSchema: { type: 'object', required: ['studentId', 'courseId'],
      properties: {
        studentId: { type: 'string' },
        courseId:  { type: 'string' },
        useCredits:{ type: 'boolean', default: true },
      },
    },
    safetyNote: 'Check prerequisite courses and membership entitlements before enrolling',
  },
  {
    name: 'retrieve_lesson',
    description: 'Return lesson content: video URL, transcript, attachments, and pose annotations.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['lessonId', 'studentId'],
      properties: {
        lessonId:  { type: 'string' },
        studentId: { type: 'string' },
      },
    },
    safetyNote: 'Verify enrollment before returning lesson content — gate access by entitlement',
  },
  {
    name: 'submit_assignment',
    description: 'Submit a written reflection, pose challenge, or quiz answer for a lesson.',
    tier: 'customer_confirm', riskLevel: 2,
    inputSchema: { type: 'object', required: ['lessonId', 'studentId', 'submissionText'],
      properties: {
        lessonId:       { type: 'string' },
        studentId:      { type: 'string' },
        submissionText: { type: 'string' },
        attachmentUrls: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'get_student_progress',
    description: "Retrieve a student's course progress: completed lessons, quiz scores, and time invested.",
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['studentId'],
      properties: {
        studentId:  { type: 'string' },
        courseId:   { type: 'string', description: 'Omit to get all courses' },
      },
    },
  },
  {
    name: 'issue_certificate_request',
    description: 'Trigger a certificate issuance when a student completes all course requirements.',
    tier: 'staff_approval', riskLevel: 3,
    inputSchema: { type: 'object', required: ['studentId', 'courseId', 'verifiedBy'],
      properties: {
        studentId:  { type: 'string' },
        courseId:   { type: 'string' },
        verifiedBy: { type: 'string', description: 'Teacher or admin who verified completion' },
      },
    },
    safetyNote: 'Verify all required lessons are completed and quiz pass threshold met before issuing',
    tags: ['requires_approval'],
  },
  {
    name: 'get_quiz_results',
    description: 'Retrieve quiz attempt history and scores for a student on a specific lesson.',
    tier: 'staff', riskLevel: 1,
    inputSchema: { type: 'object', required: ['studentId', 'lessonId'],
      properties: {
        studentId: { type: 'string' },
        lessonId:  { type: 'string' },
      },
    },
  },
];

export const LEARNING_MCP: McpServerManifest = {
  id:          'learning-mcp',
  slug:        'learning-mcp',
  name:        'Learning MCP',
  description: 'Yoga course catalogue, enrollment, lesson delivery, assignment submission, progress tracking, and certificate issuance.',
  version:     '1.0.0',
  tools:       TOOLS,
  backingServices: ['Moodle', 'Frappe Education', 'PeerTube (video)', 'Gotenberg (PDF certificates)'],
  availability: 'custom',
  implementationNote: 'Community Moodle MCP projects exist — audit before using. Wrap Moodle Web Services API with strict enrollment-gated content access.',
};
