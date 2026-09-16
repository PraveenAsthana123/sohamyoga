import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTENT_PROMPTS: Record<string, (b: Record<string, string>) => string> = {
  event_description: (b) => `Write a detailed, engaging Meetup.com event description (200-300 words) for this Calgary community event:
Group: ${b.group_name || 'Community Group'}
Event: ${b.event_title || 'Community Event'}
Category: ${b.category || 'community'}
Description: ${b.event_description || ''}

Include:
- Warm, welcoming opening that excites potential attendees
- Clear agenda or what to expect
- Who should attend (target audience)
- What to bring or prepare
- Community vibe and networking opportunities
- A call to action at the end
Keep the tone friendly, energetic and community-focused. Calgary context welcome.`,

  social_post_facebook: (b) => `Write a casual, engaging Facebook post to promote this Calgary community event:
Group: ${b.group_name || 'Community Group'}
Event: ${b.event_title || 'Community Event'}
Description: ${b.event_description || ''}
Keep it 150-200 words, conversational, use 2-3 relevant emojis, include a clear call to action. Calgary/Alberta local flavour welcome.`,

  social_post_linkedin: (b) => `Write a professional LinkedIn post to promote this community event:
Group: ${b.group_name || 'Community Group'}
Event: ${b.event_title || 'Community Event'}
Category: ${b.category || 'professional networking'}
Description: ${b.event_description || ''}
Keep it 150-200 words, professional but approachable, focus on professional development and networking value. No hashtag spam — 3 relevant hashtags max.`,

  social_post_discord: (b) => `Write a casual, exciting Discord server announcement for this community event:
Group: ${b.group_name || 'Community Group'}
Event: ${b.event_title || 'Community Event'}
Description: ${b.event_description || ''}
Keep it under 100 words, casual, energetic, use 1-2 emojis, Discord markdown formatting (@here style).`,

  social_post_whatsapp: (b) => `Write a brief, friendly WhatsApp group message to promote this community event:
Group: ${b.group_name || 'Community Group'}
Event: ${b.event_title || 'Community Event'}
Description: ${b.event_description || ''}
Keep it under 80 words, very casual, 2-3 emojis, like texting a friend. Include: what, when, RSVP ask.`,

  reminder_email: (b) => `Write a 48-hour reminder email for community event attendees:
Group: ${b.group_name || 'Community Group'}
Event: ${b.event_title || 'Community Event'}
Description: ${b.event_description || ''}
Include: subject line suggestion, warm greeting, key logistics reminder (date, time, location/link), what to bring, excitement builder, and sign-off from the organizer. 150-200 words total body.`,

  welcome_message: (b) => `Write a warm welcome message for a new member joining this Calgary community group:
Group: ${b.group_name || 'Community Group'}
Category: ${b.category || 'community'}
Write a friendly 100-150 word welcome message that:
- Celebrates their decision to join
- Gives them a quick sense of what the group is about
- Tells them how to get involved (attend events, introduce themselves)
- Makes them feel immediately included
- Ends with an invitation to the next event`,

  recap_post: (b) => `Write a post-event social media recap for this community event:
Group: ${b.group_name || 'Community Group'}
Event: ${b.event_title || 'Community Event'}
Description: ${b.event_description || ''}
Write a 150-200 word recap that:
- Celebrates what happened and the community that showed up
- Highlights key moments or takeaways (generic but enthusiastic)
- Thanks attendees, speakers, or sponsors
- Builds excitement for the next event
- Ends with a call to RSVP for the next one
Tone: warm, grateful, community-proud.`,
};

function fallbackContent(content_type: string, group_name: string, event_title: string): string {
  const g = group_name || 'our community group';
  const e = event_title || 'our upcoming event';
  const map: Record<string, string> = {
    event_description: `Join ${g} for ${e}! This is a fantastic opportunity to connect with like-minded individuals in Calgary. Whether you're new to the community or a long-time member, you'll find a welcoming space to learn, share, and grow together. Our events are designed to be engaging, informative, and most importantly — fun! Come ready to participate, network, and leave with new connections and fresh ideas. RSVP today to secure your spot. We look forward to seeing you there!`,
    social_post: `🎉 Exciting event coming up from ${g}! Join us for ${e}. Connect with your Calgary community, share ideas, and make new friends. Spots are limited — RSVP today! 🗓️`,
    reminder_email: `Subject: Don't forget — ${e} is in 48 hours!\n\nHi there,\n\nJust a friendly reminder that ${e} with ${g} is happening in 48 hours. We're so excited to see you there! Please check your original confirmation for location and timing details. See you soon!`,
    welcome_message: `Welcome to ${g}! 🎉 We're so glad you joined our Calgary community. Here you'll find a welcoming group of people passionate about connecting and growing together. Feel free to introduce yourself and check out our upcoming events. Your first meetup is just around the corner — we can't wait to meet you in person!`,
    recap_post: `What an amazing event! 🙌 Thank you to everyone who joined ${g} for ${e}. The energy, conversations, and connections made last night were truly special. Calgary has an incredible community and you all prove it every time. Stay tuned for our next event — you won't want to miss it! 🌟`,
  };
  const key = Object.keys(map).find(k => content_type.startsWith(k)) || 'social_post';
  return map[key];
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: Record<string, string>;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const { content_type, group_name, event_title, event_description, category, platform } = body;
  if (!content_type) return Response.json({ error: 'content_type required.' }, { status: 400 });

  // Build the effective content type key (social posts include platform)
  let typeKey = content_type;
  if (content_type === 'social_post' && platform) {
    typeKey = `social_post_${platform}`;
  }

  const promptFn = CONTENT_PROMPTS[typeKey] || CONTENT_PROMPTS['social_post_facebook'];
  const prompt = promptFn({ group_name, event_title, event_description, category, platform });

  let content = fallbackContent(content_type, group_name, event_title);

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (ollamaRes.ok) {
      const data = await ollamaRes.json() as { response?: string };
      if (data.response?.trim()) content = data.response.trim();
    }
  } catch { /* graceful fallback to template */ }

  return Response.json({ content });
}
