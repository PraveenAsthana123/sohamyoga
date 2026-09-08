// Real Zod validation -- TalentsHill-inspired adoption, scoped to this new
// module (closes TD-12's pattern for new code; not retrofitted onto the
// existing 383 routes, which was explicitly out of scope for this pass).
import { z } from 'zod';

export const createAssessmentSchema = z.object({
  frameworkId: z.string().uuid({ message: 'frameworkId must be a valid UUID' }),
  subject: z.string().trim().min(1, 'subject is required').max(200),
  score: z.number().int().min(0).max(100).nullable().optional(),
  assessorName: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
