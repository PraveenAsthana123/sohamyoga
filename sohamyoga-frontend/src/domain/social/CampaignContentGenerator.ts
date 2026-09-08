import { ollama } from '../../cron/OllamaClient';

// Prompt-to-Campaign content generation: one campaign brief prompt produces
// multiple channel-adapted copy_text assets in a single pass. Closes a
// named gap from the ChatGPT platform-blueprint conversation (idx 51,
// "Content Management & AI Content Factory" -- "one prompt to complete
// campaign content"). Only copy_text is generated -- image/video assets
// would need a real image/video generation pipeline this app doesn't have,
// so this deliberately doesn't fabricate those asset types.
const CHANNELS = ['instagram_caption', 'email_subject_body', 'sms_text', 'blog_snippet'] as const;
export type CampaignChannel = typeof CHANNELS[number];

export interface GeneratedContentPiece {
  channel: CampaignChannel;
  title: string;
  bodyText: string;
}

const CHANNEL_INSTRUCTIONS: Record<CampaignChannel, string> = {
  instagram_caption: 'An Instagram caption, max 2200 characters, warm and visual, 3-5 relevant hashtags at the end.',
  email_subject_body: 'An email with a subject line (max 60 chars) then the body (max 400 chars), format as "SUBJECT: ...\\nBODY: ...".',
  sms_text: 'A single SMS message, max 160 characters, no hashtags, include a clear call to action.',
  blog_snippet: 'A short blog intro paragraph, 2-3 sentences, that could open a longer post on this topic.',
};

function buildPrompt(brief: string, channel: CampaignChannel): string {
  return `You are a marketing copywriter for a yoga studio.
Campaign brief: ${brief}

Write: ${CHANNEL_INSTRUCTIONS[channel]}
Return ONLY the content itself, no explanation, no markdown.`;
}

export async function generateCampaignContent(brief: string, channels: CampaignChannel[] = [...CHANNELS]): Promise<GeneratedContentPiece[]> {
  const pieces: GeneratedContentPiece[] = [];
  for (const channel of channels) {
    const text = await ollama.generate(buildPrompt(brief, channel), {
      tier: 'strong',
      maxTokens: 500,
      timeoutMs: 45_000,
    });
    let title = `${channel.replace(/_/g, ' ')} — ${brief.slice(0, 40)}`;
    let bodyText = text.trim();
    if (channel === 'email_subject_body') {
      const subjectMatch = text.match(/SUBJECT:\s*(.+)/i);
      const bodyMatch = text.match(/BODY:\s*([\s\S]+)/i);
      if (subjectMatch) title = subjectMatch[1].trim();
      if (bodyMatch) bodyText = bodyMatch[1].trim();
    }
    pieces.push({ channel, title, bodyText });
  }
  return pieces;
}
