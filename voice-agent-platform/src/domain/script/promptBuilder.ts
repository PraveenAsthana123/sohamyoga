import { CallScriptSections } from './CallScriptVersion';

/** Single source of truth for the exact system prompt Vapi receives --
 * shared between VapiAssistantSync.ts (server, actually syncs) and the
 * script editor UI (client, shows a live size estimate) so the number
 * shown to a business is never an approximation of what gets sent. */
export function buildSystemPrompt(sections: CallScriptSections): string {
  const questions = sections.discoveryQuestions.length
    ? sections.discoveryQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')
    : '(none specified)';
  return [
    `You are a phone agent following this script exactly. Do not improvise outside these sections.`,
    ``,
    `## Opening`,
    sections.opening,
    ``,
    `## Discovery questions`,
    questions,
    ``,
    `## Objection handling`,
    sections.objectionHandling || '(none specified)',
    ``,
    `## Closing`,
    sections.closing,
  ].join('\n');
}

/** Rough token estimate (chars/4, the standard rule-of-thumb for English
 * text) -- not exact, but good enough to flag a script that has drifted
 * away from a small, cheap system prompt. Vapi's own cost guidance targets
 * ~1,500 tokens for a well-scoped assistant prompt; this app's flat
 * 4-section scripts should comfortably stay well under that. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export const RECOMMENDED_MAX_PROMPT_TOKENS = 1500;

export interface BusinessContext {
  servicesDescription: string;
  pricingInfo: string;
  businessHours: string;
  holidaysClosures: string;
  welcomeNote: string;
  thankYouNote: string;
  paymentNote: string;
}

/** Auto-grounds the assistant in real business facts the business itself
 * entered in their profile (never fabricated) -- closes the gap flagged
 * repeatedly this session where profile data and script content were
 * completely disconnected. Only non-empty fields are included, so an
 * incomplete profile doesn't inject empty/placeholder-looking lines. */
export function buildBusinessContextBlock(context: BusinessContext): string {
  const lines: string[] = [];
  if (context.servicesDescription) lines.push(`Services: ${context.servicesDescription}`);
  if (context.pricingInfo) lines.push(`Pricing: ${context.pricingInfo}`);
  if (context.businessHours) lines.push(`Hours: ${context.businessHours}`);
  if (context.holidaysClosures) lines.push(`Holidays/closures: ${context.holidaysClosures}`);
  if (context.welcomeNote) lines.push(`Preferred welcome style: ${context.welcomeNote}`);
  if (context.thankYouNote) lines.push(`Preferred sign-off style: ${context.thankYouNote}`);
  if (context.paymentNote) lines.push(`Payment/booking note: ${context.paymentNote}`);
  if (!lines.length) return '';
  return `\n\n## Business context (from the business's own profile)\n${lines.join('\n')}`;
}
