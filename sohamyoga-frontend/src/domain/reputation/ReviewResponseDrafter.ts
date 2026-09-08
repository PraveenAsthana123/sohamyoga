import { ollama } from '../../cron/OllamaClient';

// AI Response Draft -- confirmed this session as a genuine gap (no AI-drafted
// reply feature existed anywhere in the reputation module). Drafts a real
// reply from the review's own actual star rating and comment; never invents
// specifics not present in the review, never auto-sends -- staff edits and
// submits via the existing real POST /api/service-reviews/[id]/respond.
const SYSTEM = `You are a yoga studio owner replying to a customer review. Write a warm, professional
reply (2-4 sentences). If the rating is low (1-2 stars) or the comment mentions a problem, acknowledge
it directly and offer to make it right -- do not be defensive. If the rating is high (4-5 stars), thank
them genuinely and invite them back. Never invent specific facts, promises, discounts, or names not
present in the review itself. Return only the reply text, no quotes, no markdown, no commentary.`;

// The model sometimes continues past the actual reply and hallucinates a
// second, unrelated "Class: ... Rating: ... Review: ..." example (observed
// live) -- cut off at the first sign it's echoing the prompt format again.
function stripHallucinatedContinuation(text: string): string {
  const cutoff = text.search(/\n\s*(Class:|Rating:|Review:)/i);
  return (cutoff === -1 ? text : text.slice(0, cutoff)).trim();
}

export async function draftReviewResponse(starRating: number, comment: string, className: string): Promise<string> {
  const prompt = `Class: ${className}\nRating: ${starRating}/5 stars\nReview: ${comment || '(no written comment)'}`;
  const raw = await ollama.generate(prompt, { tier: 'strong', system: SYSTEM, maxTokens: 300, timeoutMs: 45_000 });
  return stripHallucinatedContinuation(raw.trim().replace(/^["']|["']$/g, ''));
}
