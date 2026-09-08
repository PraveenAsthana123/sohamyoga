// Real, honest User-Agent-based bot heuristic -- catches the common,
// well-known crawler/preview-fetcher/scripted-client signatures. This is a
// heuristic, not a guarantee: a UA string is trivially spoofable, so this
// filters obvious/lazy bots (search crawlers, link-preview fetchers,
// default HTTP client libraries) rather than claiming to stop determined
// click fraud. Documented as exactly that in every caller, never oversold
// as a complete fraud-prevention system.
const BOT_UA_PATTERN = /bot|crawl|spider|slurp|facebookexternalhit|slackbot|telegrambot|whatsapp|discordbot|embedly|quora link preview|pinterest|linkedinbot|twitterbot|redditbot|headlesschrome|phantomjs|curl\/|wget\/|python-requests|python-urllib|axios\/|node-fetch|go-http-client|java\/|libwww-perl|scrapy/i;

export function isLikelyBot(userAgent: string | null): boolean {
  if (!userAgent || !userAgent.trim()) return true; // no UA at all is itself a strong signal of a scripted client
  return BOT_UA_PATTERN.test(userAgent);
}
