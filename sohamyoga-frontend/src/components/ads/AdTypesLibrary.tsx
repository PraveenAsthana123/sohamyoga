'use client';
import { useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface PlatformEntry {
  platform: string;
  format: string;
  cta: string;
}

interface KpiEntry {
  metric: string;
  benchmark: string;
  indicates: string;
}

interface AdTypeDefinition {
  key: string;
  name: string;
  icon: string;
  psychology: string;
  psychologyTrigger: string;
  shortDesc: string;
  headlineFormulas: string[];
  copyFramework: { hook: string; body: string; cta: string; example: string };
  dos: string[];
  donts: string[];
  bestPractices: string[];
  mistakes: string[];
  platforms: PlatformEntry[];
  kpis: KpiEntry[];
  ollamaPrompt: string;
  b2bNote: string;
  b2cNote: string;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const AD_TYPES: AdTypeDefinition[] = [
  {
    key: 'topic',
    name: 'Topic Ads',
    icon: '📌',
    psychology: 'Relevance & Authority',
    psychologyTrigger: 'Relevance bias — audiences process topic-congruent ads 3x faster',
    shortDesc: 'Ads built around a specific subject/theme that the audience is already interested in or searching for.',
    headlineFormulas: [
      'Everything You Need to Know About [TOPIC] — Starting Today',
      '[TOPIC] for [AUDIENCE]: The [YEAR] Complete Guide',
      'Your [TOPIC] Journey Starts Here — [BRAND/OFFER]',
      '[NUMBER] [TOPIC] Essentials Every [AUDIENCE] Should Know',
      'The [ADJECTIVE] Way to [BENEFIT] Through [TOPIC]',
    ],
    copyFramework: {
      hook: 'Open with a statement or question that names the topic and audience together.',
      body: 'Problem → most people explore [topic] but never go deep enough. Agitate → you try once and give up. Solution → [Brand] gives you a structured path with expert guidance and measurable results.',
      cta: 'Start your [topic] journey today — first class free.',
      example: 'Yoga isn\'t just stretching. It\'s a complete system for reducing stress, building strength, and finding clarity — and most people only scratch the surface.\n\nAt Soham Yoga, we\'ve guided 2,000+ students from first-timer to consistent practitioner. Our instructors meet you where you are.\n\nClasses available 7 days a week. First class is on us.\n\n→ Try your first class free',
    },
    dos: [
      'Use the topic keyword in the first headline or first line of copy',
      'Match visual theme exactly to the topic — no stock photo mismatches',
      'Segment by topic sub-category (not "yoga" but "hot yoga for beginners")',
      'Link to a landing page dedicated to that exact topic (not the homepage)',
      'Use social proof that references the topic specifically',
    ],
    donts: [
      'Don\'t mix multiple unrelated topics in one ad — dilutes relevance signal',
      'Don\'t use generic stock imagery that could belong to any brand',
      'Don\'t send topic-specific ad traffic to a generic homepage',
      'Don\'t ignore platform topic-targeting tools (interest targeting, keywords)',
      'Don\'t run the same creative for 90+ days without refreshing',
    ],
    bestPractices: [
      'Layer topic targeting with demographic targeting for precision',
      'Create separate ad sets per topic sub-niche',
      'Use topic-specific landing pages with matching headline mirroring',
      'Rotate 3–5 creative variants to fight ad fatigue',
      'Build a topic content series (awareness → education → conversion)',
    ],
    mistakes: [
      'Too broad a topic ("health" vs. "postpartum yoga recovery")',
      'Topic in headline but none in body or landing page',
      'No clear conversion path after audience engages with topic content',
      'Assuming topic interest = purchase intent (requires funnel nurturing)',
      'Forgetting negative audiences (exclude people who already converted)',
    ],
    platforms: [
      { platform: 'Google Search', format: 'RSA', cta: 'Learn More / Explore [Topic]' },
      { platform: 'Meta/Facebook Feed', format: 'Single Image or Carousel', cta: 'Learn More / Shop Now' },
      { platform: 'Instagram Feed', format: 'Single Image or Carousel', cta: 'Explore / Learn More' },
      { platform: 'LinkedIn Sponsored', format: 'Single Image + Article', cta: 'Read Article' },
      { platform: 'YouTube', format: 'TrueView In-Stream (30–60s)', cta: 'End-screen CTA' },
      { platform: 'TikTok', format: 'In-Feed Video (9–15s)', cta: 'Learn More' },
      { platform: 'Pinterest', format: 'Standard Pin or Video Pin', cta: 'Visit Website' },
    ],
    kpis: [
      { metric: 'CTR', benchmark: '1.5–3.5% (search), 0.5–1.5% (display)', indicates: 'Relevance of topic to audience' },
      { metric: 'CPC', benchmark: '$0.50–$2.50 (B2C), $3–$8 (B2B)', indicates: 'Competitive intensity in topic' },
      { metric: 'Conversion Rate', benchmark: '2–5%', indicates: 'Topic-to-intent alignment' },
      { metric: 'ROAS', benchmark: '2.5x+', indicates: 'Revenue return per dollar' },
      { metric: 'Engagement Rate', benchmark: '3–6%', indicates: 'Audience resonance' },
    ],
    ollamaPrompt: `You are a digital ad copywriter specializing in [INDUSTRY] brands.
Generate 5 Google Search Ad headlines (max 30 characters each) for a Topic Ad about [TOPIC]
targeting [AUDIENCE DESCRIPTION].
Headlines should feel [TONE: approachable/authoritative/curious].
Return as JSON array: ["headline1", "headline2", "headline3", "headline4", "headline5"]`,
    b2bNote: 'Professional, ROI-focused tone. LinkedIn + Google priority. Long-form whitepapers/demos.',
    b2cNote: 'Emotive, aspirational, lifestyle language. Meta + Instagram priority. Free trial / first session.',
  },
  {
    key: 'dos_donts',
    name: "Dos & Don'ts Ads",
    icon: '✅❌',
    psychology: 'Contrast & Clarity',
    psychologyTrigger: 'Contrast effect — the brain is wired to notice differences faster than similarities',
    shortDesc: "Contrast-format ads that show the right vs. wrong approach, positioning the brand as the guide to better behavior.",
    headlineFormulas: [
      'Stop [WRONG BEHAVIOR] — [RIGHT BEHAVIOR] Works 3x Better',
      "Don't [COMMON MISTAKE] — Do [BETTER APPROACH] Instead",
      '[AUDIENCE]: Are You [DOING THIS WRONG]? Here\'s the Right Way',
      'Wrong: [BEHAVIOR A] | Right: [BEHAVIOR B] — Know the Difference',
      '[NUMBER] Things You\'re Doing Wrong with [TOPIC] (And How to Fix Them)',
    ],
    copyFramework: {
      hook: 'Call out a specific wrong behavior the audience recognizes in themselves.',
      body: "DON'T [specific wrong behavior] — here's why it's hurting your [outcome]. DO [specific right behavior] — this is what successful people do instead. Making this switch changed [metric] for [social proof reference].",
      cta: 'See the full dos and don\'ts guide →',
      example: "Don't track projects in a spreadsheet that 6 people edit simultaneously — you'll spend 3 hours a week reconciling conflicts.\n\nDo use a single source of truth where every task has an owner, a deadline, and an auto-updated status visible to the whole team.\n\nTeams that make this switch report 40% fewer missed deadlines in the first 90 days.\n\n→ Compare the difference — try free for 14 days",
    },
    dos: [
      'Make the "don\'t" behavior specific and relatable — not generic',
      'Ensure the "do" behavior is achievable, not aspirational fantasy',
      "Use the brand's product as the natural enabler of the 'do'",
      'Keep contrast visual — don\'t make the audience read to understand it',
      "Use real data or testimonials to validate the 'do' behavior",
    ],
    donts: [
      "Don't shame the audience — the 'don't' should be sympathetic, not judgmental",
      "Don't make the 'don't' an implicit attack on a competitor (brand safety risk)",
      'Don\'t present more than 3 contrasts in one ad (cognitive overload)',
      'Don\'t use ambiguous contrasts that require explanation to understand',
      'Don\'t forget to show the outcome — contrast without result = incomplete',
    ],
    bestPractices: [
      '"Don\'t/Do" vs. "Wrong/Right" — A/B test tone across audience segments',
      'Use the contrast as a retargeting trigger for high-intent audiences',
      'Follow with a content piece (blog, video) that expands the list',
      'Track "save" rate on Instagram — high saves = high resonance',
      'Sequence: Dos/Don\'ts awareness → product demo → free trial',
    ],
    mistakes: [
      'Making the "do" so obvious it\'s patronizing',
      'Contrast so abstract it communicates nothing ("inefficient → efficient")',
      "No brand/product connection to the 'do' outcome",
      'Platform mismatch — detailed contrast works in LinkedIn, not TikTok',
      'Failing to address why the wrong behavior felt easier/natural',
    ],
    platforms: [
      { platform: 'Meta/Facebook Feed', format: 'Split-screen video or Carousel', cta: 'Learn More' },
      { platform: 'Instagram Feed', format: 'Side-by-side layout', cta: 'Save This' },
      { platform: 'LinkedIn Sponsored', format: 'Document Ad / Sponsored Content', cta: 'Download' },
      { platform: 'Google Search', format: 'RSA with contrast in headlines', cta: 'See How' },
      { platform: 'TikTok', format: 'Duet-style or split-screen video', cta: 'Follow for More' },
      { platform: 'Pinterest', format: 'Infographic Pin', cta: 'Visit Website' },
      { platform: 'YouTube', format: 'Tutorial-style pre-roll', cta: 'Learn More' },
    ],
    kpis: [
      { metric: 'CTR', benchmark: '2–4% (social), 3–5% (search)', indicates: 'Contrast resonance with audience' },
      { metric: 'Save Rate (Instagram)', benchmark: '2–5%', indicates: 'High-value content signal' },
      { metric: 'Conversion Rate', benchmark: '3–7%', indicates: '"Do" behavior intent translation' },
      { metric: 'ROAS', benchmark: '3x+', indicates: 'Conversion efficiency' },
      { metric: 'Engagement Rate', benchmark: '4–8%', indicates: 'Contrast interest level' },
    ],
    ollamaPrompt: `You are a copywriter for [BRAND] selling [PRODUCT/SERVICE].
Write a Facebook Dos & Don'ts ad (max 130 words).
Don't behavior: [SPECIFIC WRONG BEHAVIOR]
Do behavior: [SPECIFIC RIGHT BEHAVIOR]
Result: [QUANTIFIED OUTCOME]
CTA: [CTA TEXT]
Tone: [TONE]. Never shame the reader. Always normalize the 'don't' before calling it out.`,
    b2bNote: 'Process efficiency and cost avoidance framing. LinkedIn priority. Assessment/audit offer.',
    b2cNote: 'Personal improvement and lifestyle upgrade framing. Meta/Instagram priority. Checklist/guide offer.',
  },
  {
    key: 'best_practices',
    name: 'Best Practices Ads',
    icon: '🏆',
    psychology: 'Authority & Reciprocity',
    psychologyTrigger: 'Authority bias — humans defer to perceived experts; reciprocity from receiving value',
    shortDesc: 'Authority-positioning ads that share proven, expert-validated methodology — building trust before asking for anything.',
    headlineFormulas: [
      '[NUMBER] [TOPIC] Best Practices Every [AUDIENCE] Should Follow',
      'The [INDUSTRY]-Proven Method for [OUTCOME] — Used by [SOCIAL PROOF]',
      'Industry Standard: How [AUDIENCE] Achieve [RESULT] in [TIMEFRAME]',
      '[YEAR] Best Practices for [TOPIC]: Updated by [CREDENTIAL]',
      'What High-Performing [AUDIENCE] Do Differently — Best Practice Guide',
    ],
    copyFramework: {
      hook: 'Open with a credential or outcome statement that signals authority.',
      body: 'Present 2–3 specific, actionable best practices — each concrete enough that the reader gains value from reading it alone.',
      cta: 'Get the complete best practices guide — [NUMBER] more practices inside.',
      example: "After 10 years working with engineering teams, here are the 3 project management best practices that separate high performers:\n\n1. Every task has one owner, not a team. Shared ownership = no ownership.\n2. Status updates happen in the tool, not meetings. If it's not logged, it didn't happen.\n3. Retrospectives run on data, not memory.\n\nThese practices reduced missed deadlines by 42% for our customers in 2025.\n\n→ Get the full 15-practice guide — free download",
    },
    dos: [
      'Back each best practice with data, customer results, or research citation',
      'Make practices specific and actionable, not vague',
      'Reference credibility: years of experience, customer count, industry recognition',
      'Link to a full content piece — the ad is the preview, not the full value',
      'Tailor practices to the specific audience segment (beginner vs. advanced)',
    ],
    donts: [
      "Don't list generic advice that any blog could have written",
      'Don\'t claim "best practice" status without supporting evidence',
      "Don't write practices so basic they feel obvious to the target audience",
      "Don't bury the brand — authority comes from the brand, keep it visible",
      "Don't forget to include a content upgrade (guide, checklist) as the CTA offer",
    ],
    bestPractices: [
      'Gate the full best practices list behind an email opt-in for lead gen',
      'Update "best practices" content seasonally to maintain relevance',
      'Source practices from real customer data and present the methodology',
      'Repurpose into multiple formats: ad, blog, email series, webinar',
      'Use LinkedIn Document Ads for B2B — highest engagement for list content',
    ],
    mistakes: [
      'Practices that are too theoretical with no implementation guidance',
      'No differentiation — practices identical to what competitors publish',
      'Over-claiming ("the only best practice framework you\'ll ever need")',
      'No measurement criteria for whether a practice is working',
      'Single creative execution across all platforms — format must match platform norms',
    ],
    platforms: [
      { platform: 'LinkedIn', format: 'Document Ad / Sponsored Article', cta: 'Download / Read More' },
      { platform: 'Instagram Feed', format: 'Infographic Carousel (5–10 slides)', cta: 'Save This' },
      { platform: 'Meta/Facebook Feed', format: 'Carousel (one practice per slide)', cta: 'Get the Full List' },
      { platform: 'Google Search', format: 'RSA with authority signals', cta: 'Learn Best Practices' },
      { platform: 'YouTube', format: 'Tutorial/explainer pre-roll', cta: 'Subscribe / Learn More' },
      { platform: 'Pinterest', format: 'Checklist or step-by-step Pin', cta: 'Visit Website' },
      { platform: 'Twitter/X', format: 'Thread of best practices', cta: 'Retweet to Save' },
    ],
    kpis: [
      { metric: 'CTR', benchmark: '1.5–3%', indicates: 'Authority resonance' },
      { metric: 'Save Rate', benchmark: '3–7% (Instagram carousel)', indicates: 'Content value signal' },
      { metric: 'Lead Conversion Rate', benchmark: '5–15% (gated content)', indicates: 'Intent quality' },
      { metric: 'CPL (Cost Per Lead)', benchmark: '$5–$25 (B2C), $20–$100 (B2B)', indicates: 'Authority positioning efficiency' },
      { metric: 'Email Open Rate (follow-up)', benchmark: '35%+', indicates: 'Authority trust transfer' },
    ],
    ollamaPrompt: `You are a B2B marketing copywriter. Write a LinkedIn Best Practices ad (max 130 words).
Industry: [INDUSTRY]. Topic: [SPECIFIC TOPIC].
Include 3 numbered best practices, each with a one-sentence outcome rationale.
Credential signal: [YEARS/CUSTOMERS/DATA SOURCE]
CTA: Download the [NUMBER]-practice guide (free).
Tone: authoritative, data-backed, peer-to-peer — operator speaking to fellow operators.`,
    b2bNote: 'Industry-specific, data-backed. LinkedIn priority. Research report / benchmark offer.',
    b2cNote: 'Expert-but-accessible, empowering. Instagram / Pinterest priority. Checklist / quiz offer.',
  },
  {
    key: 'knowledge',
    name: 'Knowledge Ads',
    icon: '🧠',
    psychology: 'Curiosity & Novelty',
    psychologyTrigger: 'Novelty bias — new information triggers dopamine; curiosity gap creates itch to know more',
    shortDesc: 'Educational ads that deliver a genuine learning moment inside the ad itself — a surprising fact, insight, or framework the audience didn\'t know before.',
    headlineFormulas: [
      'Did You Know? [SURPRISING FACT ABOUT TOPIC] — [IMPLICATION]',
      'Why [AUDIENCE] [DO THIS THING] — The Science Behind It',
      'The [TOPIC] Fact That Changed How [NUMBER] People [BEHAVIOR]',
      'What [EXPERT SOURCE] Says About [TOPIC] — [KEY INSIGHT]',
      '[COMMON BELIEF] Is Wrong — Here\'s What the Data Actually Shows',
    ],
    copyFramework: {
      hook: 'Open with a genuinely surprising, specific fact or counterintuitive insight.',
      body: 'Explain the mechanism — why is this true? What does it mean for the reader? Connect the knowledge to a practical implication for their life/work.',
      cta: 'Explore [NUMBER] more insights like this →',
      example: "Did you know? Holding a yoga pose for just 90 seconds triggers neurological changes that reduce cortisol for up to 4 hours.\n\nThis is why yoga works beyond just the stretch — it's a nervous system reset. The longer your hold, the more your parasympathetic system activates.\n\nMost workout formats ignore this mechanism. Yoga doesn't.\n\nAt Soham Yoga, every session is designed around this science — not just flexibility.\n\n→ Watch the 3-minute explainer — free",
    },
    dos: [
      'Verify every fact, statistic, and research reference before publishing',
      'Make the knowledge immediately useful — "so what?" must be answered in the ad',
      'Match complexity level to audience (don\'t over-simplify for experts)',
      'Follow up with a content piece that deepens the learning',
      'Source data visibly — "Based on [Study/Organization]" builds credibility',
    ],
    donts: [
      "Don't use fabricated statistics or unverified claims",
      "Don't make the knowledge so complex it requires prior expertise",
      "Don't bury the learning insight behind brand messaging — knowledge first",
      'Don\'t forget attribution — "studies show" without specifics is weak',
      "Don't make every knowledge ad a sales pitch — let the learning stand",
    ],
    bestPractices: [
      'Build a content calendar of knowledge ads around seasonal relevance',
      'Use knowledge ads as top-of-funnel to build retargeting audiences',
      'Link to expanded content (research summary) — not a sales page',
      'A/B test: statistic vs. mechanism vs. myth-bust',
      'Repurpose high-performing knowledge ads into email newsletter content',
    ],
    mistakes: [
      '"Knowledge" that\'s actually just product marketing dressed up as insight',
      'Sourcing issues — citing unverifiable or overstated research',
      'No practical application — reader learns but can\'t act on it',
      'Audience mismatch — experts don\'t want basics; beginners need context',
      'One-and-done approach — knowledge ads build best over a content series',
    ],
    platforms: [
      { platform: 'Instagram Feed', format: 'Infographic Carousel / Reel', cta: 'Save This' },
      { platform: 'YouTube', format: 'Explainer pre-roll (60–120s)', cta: 'Subscribe / Learn More' },
      { platform: 'TikTok', format: '"Did you know?" rapid-fire format (30–45s)', cta: 'Follow for Daily Tips' },
      { platform: 'LinkedIn', format: 'Article preview or Document Ad', cta: 'Read Full Article' },
      { platform: 'Meta/Facebook Feed', format: 'Video explainer or Carousel', cta: 'Watch / Read More' },
      { platform: 'Pinterest', format: 'Educational infographic (2:3 tall)', cta: 'Visit Website' },
      { platform: 'Twitter/X', format: 'Thread with data/insight', cta: 'Bookmark This' },
    ],
    kpis: [
      { metric: 'Video View Rate (30s)', benchmark: '40%+', indicates: 'Knowledge engagement depth' },
      { metric: 'Save Rate', benchmark: '4–9%', indicates: 'Content utility signal' },
      { metric: 'Email Opt-in Rate', benchmark: '8–20% (from content LP)', indicates: 'Knowledge-to-relationship conversion' },
      { metric: 'CTR', benchmark: '1.5–3.5%', indicates: 'Curiosity activation rate' },
      { metric: 'Return Visitor Rate', benchmark: '25%+', indicates: 'Brand recall from learning' },
    ],
    ollamaPrompt: `You are a wellness content writer. Write a Facebook Knowledge Ad (max 120 words).
Opening fact: [SPECIFIC VERIFIABLE FACT WITH SOURCE]
Mechanism: explain why this is true in 2 sentences (plain language)
Practical implication: what should the reader do differently?
CTA: [CTA TEXT]
Tone: intellectually engaging, accessible, never condescending.
Brand: [BRAND NAME AND BRIEF DESCRIPTION]`,
    b2bNote: 'Research-backed, industry terminology. LinkedIn priority. Research report / benchmark offer.',
    b2cNote: 'Accessible, jargon-free, relatable. Instagram / TikTok / YouTube priority. Guide / quiz offer.',
  },
  {
    key: 'mistake_based',
    name: 'Mistake-Based Ads',
    icon: '⚠️',
    psychology: 'Pain Recognition & Relief',
    psychologyTrigger: '"Uh oh, that\'s me" moment — seeing your own mistake reflected triggers immediate engagement',
    shortDesc: 'Ads that open by identifying a specific, recognizable error the target audience is making — then position the brand as the solution.',
    headlineFormulas: [
      'Stop [DOING X] — [BETTER ALTERNATIVE] Works 3x Better',
      'This [COMMON MISTAKE] Is Costing [AUDIENCE] [QUANTIFIED LOSS]',
      '[NUMBER]% of [AUDIENCE] Make This [TOPIC] Mistake — Are You One?',
      'If You\'re [DOING THIS], You\'re [LEAVING RESULT ON THE TABLE]',
      'The [TOPIC] Mistake That Took Me [TIMEFRAME] to Unlearn',
    ],
    copyFramework: {
      hook: 'Name the specific mistake with enough precision that it stings a little — not "bad project management" but "reviewing status in a weekly meeting instead of a live dashboard."',
      body: 'Establish why this mistake is costly (time, money, results). Show the mistake is common — normalize it, reduce shame. Present the better path with a specific, credible improvement claim.',
      cta: 'Stop [mistake] — here\'s the [N]-step fix →',
      example: "If you're stretching before your yoga class — stop.\n\nCold static stretching before movement reduces muscular power by up to 8% and increases injury risk. Most people learned this in gym class and never unlearned it.\n\nThe correct warm-up is dynamic movement: Sun Salutations, gentle spinal rotations, hip openers. Save the deep stretching for after class.\n\nWe designed every Soham Yoga class around this principle — details like this matter.\n\n→ Book a class and see the difference",
    },
    dos: [
      'Make the mistake extremely specific — the more precise, the more recognition',
      'Normalize the mistake — "most people do this" reduces shame and increases relatability',
      'Show the mistake costs something real (time, money, health, results)',
      'Offer the fix within the ad itself — don\'t just identify the problem',
      'Sequence: mistake ad → solution content → product as the complete solution',
    ],
    donts: [
      "Don't shame the audience — empathy, not judgment",
      "Don't invent a mistake that doesn't actually exist in the audience's behavior",
      "Don't open with the solution — the mistake must land first for the framework to work",
      "Don't be preachy or repetitive about the mistake",
      "Don't make the 'fix' so complex it creates new overwhelm",
    ],
    bestPractices: [
      'Research real customer support data and sales objections for genuine mistake material',
      'Test which mistake resonates most across audience segments (multivariate)',
      'Use mistake-based ads as retargeting triggers for video viewers',
      'Pair with a "how I fixed it" customer story for social proof',
      'A/B: mistake-first frame vs. solution-first frame — audience preference varies',
    ],
    mistakes: [
      'Mistake so obvious it feels insulting to the audience',
      "No connection between the mistake and the brand's specific solution",
      'Too many mistakes in one ad — pick the single most resonant one',
      'Mistake hook in the ad, but landing page opens with benefits — message mismatch',
      "Using a mistake that implies the competitor's product is the 'wrong' choice",
    ],
    platforms: [
      { platform: 'Meta/Facebook Feed', format: 'Short video (problem reveal, 30–60s)', cta: 'Stop Doing This' },
      { platform: 'Instagram Feed', format: '"Stop [Doing X]" hook image', cta: 'Save This' },
      { platform: 'Google Search', format: 'RSA with mistake-opening headline', cta: 'Fix This Now / See Solution' },
      { platform: 'TikTok', format: '"POV: You\'re doing [mistake]" (15–30s)', cta: 'Stitch/Duet response' },
      { platform: 'YouTube', format: 'Pre-roll with mistake hook in first 5 seconds', cta: 'Fix This (end-screen)' },
      { platform: 'LinkedIn', format: 'Thought leadership post with mistake callout', cta: 'See the Fix' },
      { platform: 'Pinterest', format: '"You\'re doing [X] wrong" Pin', cta: 'Visit for fix' },
    ],
    kpis: [
      { metric: 'CTR', benchmark: '2.5–5%', indicates: 'Mistake recognition rate' },
      { metric: 'Hook Retention (video 3-sec)', benchmark: '70%+', indicates: 'Opening resonance' },
      { metric: 'Conversion Rate', benchmark: '3–8%', indicates: 'Solution urgency' },
      { metric: 'Engagement Rate', benchmark: '5–10%', indicates: 'Mistake-resonance depth' },
      { metric: 'Comment Rate', benchmark: '1–3%', indicates: '"That\'s me!" social validation signal' },
    ],
    ollamaPrompt: `You are a wellness copywriter for [BRAND]. Write a Facebook Mistake-Based ad (max 130 words).
Specific mistake: [MISTAKE — be very precise]
Why it's costly: [COST/IMPACT with data if possible]
Why it's common: [NORMALIZATION REASON — why most people make this mistake]
The fix: [SOLUTION — how [BRAND] solves this]
CTA: [CTA TEXT]
Tone: empathetic, specific, never shaming. Normalize the mistake before offering the fix.`,
    b2bNote: 'Process/productivity mistakes, ROI language. LinkedIn/Google priority. Audit/assessment offer.',
    b2cNote: 'Personal habit mistakes, lifestyle framing. Meta/TikTok/Instagram priority. Fix guide/free class offer.',
  },
  {
    key: 'risk_based',
    name: 'Risk-Based Ads',
    icon: '🔴',
    psychology: 'Loss Aversion',
    psychologyTrigger: 'Loss aversion — losses feel 2x more painful than equivalent gains feel good (Kahneman)',
    shortDesc: 'Ads that highlight danger, loss, or the quantified downside of inaction — activating the most powerful psychological force in decision-making.',
    headlineFormulas: [
      '[AUDIENCE] Who Don\'t [ACTION] Lose [QUANTIFIED AMOUNT] Every Year',
      'The Hidden Cost of Ignoring [PROBLEM] — [SCARY STAT]',
      'What Happens to [AUDIENCE] Who Wait Too Long to [ACT] — Real Data',
      '[TIMEFRAME] Without [SOLUTION] = [SPECIFIC CONSEQUENCE]',
      'By the Time [AUDIENCE] Realize [RISK], [CONSEQUENCE IS ALREADY HAPPENING]',
    ],
    copyFramework: {
      hook: 'Open with a stark, specific risk statistic or scenario. Make it concrete, not theoretical.',
      body: 'Quantify the risk with real numbers and real consequences. Personalize to the specific audience profile. Then provide a clear escape — the brand\'s solution as the risk-eliminator.',
      cta: 'Protect yourself now — [specific action]',
      example: "If you're 40 and haven't started your RRSP, you're already $180,000 behind.\n\nThat's the compound interest gap between starting at 30 vs. 40 on a $400/month contribution. The gap grows every month you wait.\n\nBy 65, that missed decade represents the difference between a comfortable retirement and financial dependency.\n\nOur retirement planning tool shows your personal gap in 3 minutes. Free, no obligation.\n\n→ See your real retirement gap",
    },
    dos: [
      'Make the risk quantifiable — vague risk doesn\'t drive action',
      'Personalize the risk to the specific audience segment',
      'Transition quickly from risk to solution — don\'t dwell on fear',
      'Use credible sources for all risk statistics',
      'Include a clear, immediate next step to mitigate the risk',
    ],
    donts: [
      "Don't create false or exaggerated risks — legal and ethical violation",
      "Don't use manipulative imagery (children in danger, explicit suffering)",
      "Don't leave the audience in fear without providing the solution",
      "Don't overuse risk framing — audiences disengage from constant alarm",
      "Don't apply risk framing to trivial decisions (disproportionate use)",
    ],
    bestPractices: [
      'A/B test: general percentage vs. personalized dollar amount',
      'Follow risk ads with a solution ad in the retargeting sequence',
      'Use countdown urgency sparingly — only when deadline is real',
      'Pair with a free risk assessment tool to capture leads',
      'Monitor frequency carefully — risk fatigue sets in faster than other types',
    ],
    mistakes: [
      'Risk so extreme it triggers disbelief rather than action',
      'No actionable step provided — risk without escape = helplessness, not motivation',
      'Targeting audiences who are already anxious (ethical and performance problem)',
      'Risk that doesn\'t apply to the target segment — loses credibility immediately',
      'Risk framing without brand trust signals — source credibility matters',
    ],
    platforms: [
      { platform: 'Google Search', format: 'RSA with urgency and risk stat', cta: 'Protect Yourself / Act Now' },
      { platform: 'Meta/Facebook Feed', format: 'Short video (consequence reveal, 30–45s)', cta: "Don't Wait / Check Your Risk" },
      { platform: 'LinkedIn Sponsored', format: 'Sponsored Content with data point', cta: 'Assess Your Risk' },
      { platform: 'YouTube', format: 'Problem consequence pre-roll (30–60s)', cta: 'Act Before It\'s Too Late' },
      { platform: 'Instagram Feed', format: 'Risk stat image with bold number', cta: 'See Solution' },
      { platform: 'TikTok', format: '"What happens if you don\'t [X]" (30s)', cta: 'Save This Warning' },
      { platform: 'Pinterest', format: 'Risk infographic (warning-style)', cta: 'Protect Yourself' },
    ],
    kpis: [
      { metric: 'CTR', benchmark: '2–5%', indicates: 'Risk relevance activation' },
      { metric: 'Conversion Rate', benchmark: '4–10%', indicates: 'Loss aversion effectiveness' },
      { metric: 'Time to Conversion', benchmark: 'Shorter than average', indicates: 'Urgency driving faster decisions' },
      { metric: 'ROAS', benchmark: '4–6x', indicates: 'High-conversion audience efficiency' },
      { metric: 'Lead Quality Score', benchmark: 'High', indicates: 'Loss-averse audiences have high intent' },
    ],
    ollamaPrompt: `You are a financial advisor copywriter. Write a Facebook Risk-Based ad (max 130 words).
Specific risk: [RISK WITH DATA POINT — specific number or statistic]
Who it affects: [AUDIENCE PROFILE — demographic and situational details]
The escape route: [BRAND'S SOLUTION]
CTA: [CTA TEXT]
Tone: informative and urgent, not fear-mongering. Always transition to the solution.
Never leave the reader in fear — always end with the path forward.`,
    b2bNote: 'Business continuity, competitive risk, regulatory penalties. LinkedIn/Google priority. Risk assessment offer.',
    b2cNote: 'Personal financial, health, safety risk. Meta/Google priority. Risk calculator / free consultation.',
  },
  {
    key: 'value_focused',
    name: 'Value-Focused Ads',
    icon: '💎',
    psychology: 'Aspirational Pull & WIIFM',
    psychologyTrigger: 'Customers buy results, not products — value ads speak the customer\'s actual language',
    shortDesc: 'Ads centered on ROI, outcome, and transformation — answering "what\'s in it for me?" before any question is asked.',
    headlineFormulas: [
      '[AUDIENCE] See [SPECIFIC RESULT] in [TIMEFRAME] — Here\'s How',
      'Transform [CURRENT STATE] to [DESIRED STATE] — [BRAND] Shows You How',
      '[NUMBER]% of [AUDIENCE] Achieve [RESULT] with [BRAND/METHOD]',
      'The [OUTCOME] [AUDIENCE] Have Been Looking For — [OFFER]',
      '[METRIC IMPROVEMENT] in [TIMEFRAME]: [AUDIENCE]\'s Real Results',
    ],
    copyFramework: {
      hook: 'Lead with the specific, desirable outcome. Make it concrete, not aspirational fluff.',
      body: 'Current state (where audience is now) → Bridge: how brand creates the transformation → Evidence: customer story, data point, or before/after.',
      cta: 'Start your [outcome] journey — [specific first step]',
      example: "80% of Soham Yoga students report significant stress reduction within 30 days.\n\nNot 'feel a bit better' — measurable: better sleep, lower resting heart rate, and the ability to pause before reacting.\n\nThat's not a marketing claim. It's what 847 students told us in our 2025 annual survey.\n\nOur 30-day Foundations program is designed for people who tried yoga before and didn't stick with it.\n\nFirst session is free. No commitment. Just results.\n\n→ Book your free first class",
    },
    dos: [
      'Quantify the value wherever possible — "$2,400 saved", "40% faster", "8 hours/week back"',
      'Use real customer testimonials and results as primary evidence',
      'Connect the outcome to the audience\'s identity and aspirations',
      'Show the path — briefly explain how the outcome is achieved',
      'Differentiate your outcome from competitors\' generic claims',
    ],
    donts: [
      "Don't claim outcomes you can't substantiate — FTC violations and brand damage",
      'Don\'t use typical/exceptional results as if they\'re average results',
      "Don't conflate features with value — 'our platform has AI' is not a value statement",
      "Don't forget the emotional value alongside functional value",
      "Don't use fabricated before/after imagery or stock 'transformation' photos",
    ],
    bestPractices: [
      'Build a customer results library with permission-granted case studies',
      'Segment value claims by audience — "value" differs per segment',
      'Track which outcome claim drives highest CTR through A/B testing',
      'Use value ads at TOFU (aspirational) and BOFU (specific ROI claim)',
      'Include risk reversal (money-back, free trial) to lower conversion barrier',
    ],
    mistakes: [
      'Generic value claims ("get better results") without specificity',
      'No evidence bridge between claim and proof',
      'Outcome that sounds too good to be true (loses credibility)',
      'Missing the emotional component of transformation (purely functional)',
      'One value claim used for all segments — each values different outcomes',
    ],
    platforms: [
      { platform: 'Meta/Facebook Feed', format: 'Video testimonial or result showcase (60–90s)', cta: 'Get Results Like This' },
      { platform: 'Instagram Feed', format: 'Results carousel or transformation imagery', cta: 'Shop / Learn More' },
      { platform: 'LinkedIn Sponsored', format: 'Case study Sponsored Content', cta: 'Read Case Study' },
      { platform: 'Google Search', format: 'RSA with outcome in headline', cta: 'Get Started / See Results' },
      { platform: 'YouTube', format: 'Customer journey story (90–180s)', cta: 'Start Your Journey' },
      { platform: 'TikTok', format: 'Authentic results video (30–60s)', cta: 'Follow for Results' },
      { platform: 'Pinterest', format: 'Transformation/results Pin', cta: 'Shop / Learn' },
    ],
    kpis: [
      { metric: 'CTR', benchmark: '2–4.5%', indicates: 'Outcome desire activation' },
      { metric: 'ROAS', benchmark: '4–8x', indicates: 'High-value conversion efficiency' },
      { metric: 'Conversion Rate', benchmark: '4–12%', indicates: 'Outcome credibility' },
      { metric: 'Average Order Value', benchmark: '+15–25% vs. feature ads', indicates: 'Outcome-anchored pricing acceptance' },
      { metric: 'Testimonial Engagement Rate', benchmark: '6–12%', indicates: 'Social proof effectiveness' },
    ],
    ollamaPrompt: `You are a wellness copywriter. Write a Facebook Value-Focused ad (max 130 words).
Target audience: [AUDIENCE DESCRIPTION — demographic and psychographic]
Outcome claim: [RESULT WITH DATA — specific number and source]
Evidence: [CUSTOMER STORY OR STAT — real or representative]
Path to outcome: [HOW PRODUCT ACHIEVES THE RESULT — 1-2 sentences]
CTA: [CTA TEXT]
Tone: confident, credible, aspirational but grounded. Never overpromise.`,
    b2bNote: 'ROI, cost reduction, productivity. LinkedIn/Google priority. Case study / demo / free audit.',
    b2cNote: 'Personal transformation, lifestyle improvement. Meta/Instagram priority. Free trial / first session free.',
  },
  {
    key: 'productivity_focused',
    name: 'Productivity-Focused Ads',
    icon: '⚡',
    psychology: 'Time Scarcity & Autonomy',
    psychologyTrigger: 'Time is the most precious non-renewable resource — regaining it = reclaiming control',
    shortDesc: 'Ads about saving time, streamlining workflows, and doing more with less — speaking directly to the universal desire to accomplish more.',
    headlineFormulas: [
      'Save [NUMBER] Hours a Week — [AUDIENCE] Switch to [SOLUTION]',
      'Do [TASK] in [FRACTION OF TIME] with [BRAND/TOOL]',
      '[AUDIENCE] Are Wasting [TIME/RESOURCE] on [PROCESS] — Here\'s the Fix',
      'The [WORKFLOW] System That Gives [AUDIENCE] Their [DAY/WEEK] Back',
      'Stop Spending [TIME] on [TASK] — [SOLUTION] Automates It',
    ],
    copyFramework: {
      hook: 'Quantify the time waste precisely — not "save time" but "reclaim 6 hours every Monday morning."',
      body: 'Current state: the specific workflow inefficiency and what it costs. The shift: how the solution transforms the process. Outcome: specific time/energy recovered and what it\'s now available for.',
      cta: 'Reclaim [time] — try free for [X] days',
      example: "The average knowledge worker spends 2.5 hours a day looking for information they've already created.\n\nNot new information. Old information. In the wrong folder, the wrong version, the wrong Slack thread.\n\nOur workspace platform puts everything in one searchable place. Three clicks from question to answer.\n\nTeams using us report 2.5 hours back per person per day. On a 10-person team, that's 25 recovered hours. Every. Single. Day.\n\n→ Try free for 14 days — no setup fee, no credit card",
    },
    dos: [
      'Lead with a specific, verifiable time-saving metric',
      'Show the before workflow (chaos/inefficiency) briefly before the solution',
      'Quantify in relatable terms: "6 hours/week" = "32 days a year"',
      'Target audiences whose specific workflow pain is addressed by the product',
      'Offer a free trial — productivity seekers want to act now',
    ],
    donts: [
      "Don't use vague productivity language ('work smarter, not harder')",
      "Don't overstate automation — be clear about what requires setup or effort",
      "Don't promise productivity gains without showing the mechanism",
      "Don't target audiences for whom productivity isn't a value driver",
      "Don't neglect quality of work — 'faster' without 'better' is insufficient",
    ],
    bestPractices: [
      'Build an ROI calculator that quantifies time savings for the prospect\'s team size',
      'Show product UI in video ads — screen recordings outperform lifestyle imagery',
      'A/B test time framing: hours/day vs. days/year vs. $ value of saved time',
      'Use LinkedIn for B2B productivity ads — highest ROI for knowledge-worker targeting',
      'Pair with a case study: "How [Company] Saved X Hours/Week"',
    ],
    mistakes: [
      'Productivity claims that apply only to power users, not average users',
      'Setup time and learning curve not disclosed — expectations misaligned',
      'Leading with features (automation, AI) instead of the productivity outcome',
      'Targeting too broadly — "anyone who works" is not a targetable segment',
      'No trial path — productivity buyers want to verify before committing',
    ],
    platforms: [
      { platform: 'LinkedIn Sponsored', format: 'Sponsored Content with productivity stat', cta: 'Read More / See How' },
      { platform: 'Google Search', format: 'RSA with time-saving claim', cta: 'Save Time Now / See How' },
      { platform: 'Meta/Facebook Feed', format: 'Before/after workflow video (60s)', cta: 'Watch How' },
      { platform: 'Instagram Reel', format: 'Tool demo Reel (30–45s)', cta: 'Try Free' },
      { platform: 'YouTube', format: 'Screen-record product demo (60–120s)', cta: 'Start Free Trial' },
      { platform: 'TikTok', format: '"I saved X hours by switching to Y" (30s)', cta: 'Link in Bio' },
      { platform: 'Pinterest', format: 'Workflow diagram Pin', cta: 'Visit Site' },
    ],
    kpis: [
      { metric: 'CTR', benchmark: '2–4%', indicates: 'Time-saving claim resonance' },
      { metric: 'Free Trial Start Rate', benchmark: '8–20%', indicates: 'Intent quality' },
      { metric: 'Trial-to-Paid Conversion', benchmark: '20–40%', indicates: 'Product promise delivery' },
      { metric: 'ROAS', benchmark: '3–6x', indicates: 'Efficiency of high-intent audience' },
      { metric: 'Time to Conversion', benchmark: 'Short', indicates: 'Urgency from productivity pain' },
    ],
    ollamaPrompt: `You are a SaaS copywriter. Write a Facebook Productivity-Focused ad (max 130 words).
Current workflow pain: [SPECIFIC INEFFICIENCY — be precise about what takes time]
Time it wastes: [QUANTIFIED TIME WASTE — hours/day, week, or month]
Solution: [HOW BRAND SOLVES IT — the specific mechanism]
Outcome: [TIME RECOVERED + what they can do with recovered time]
CTA: [CTA TEXT — free trial preferred]
Tone: energetic, specific, results-oriented. Appeals to goal-oriented professionals.`,
    b2bNote: 'ROI-quantified, team-level efficiency. LinkedIn/Google priority. Free trial / ROI calculator.',
    b2cNote: 'Personal time freedom, life balance. Meta/Instagram priority. Free plan / time-saving guide.',
  },
  {
    key: 'cost_saving',
    name: 'Cost-Saving Focused Ads',
    icon: '💰',
    psychology: 'Financial Loss Aversion',
    psychologyTrigger: 'Overpaying feels like losing money — financial loss aversion is the strongest form of loss aversion',
    shortDesc: 'Ads about reducing expenses, eliminating waste, and better pricing — leading with the specific financial benefit the customer will gain.',
    headlineFormulas: [
      'Switch to [BRAND] — Save $[AMOUNT] per [TIMEFRAME]',
      '[AUDIENCE] Overpaying by [PERCENTAGE] — See the Difference',
      'Stop Paying [PRICE] for [PRODUCT] — [BRAND] Does It for [LOWER PRICE]',
      'Cut Your [CATEGORY] Budget by [PERCENTAGE] Without Sacrificing Quality',
      '$[AMOUNT] Saved in [TIMEFRAME]: [BRAND] vs. [ALTERNATIVE]',
    ],
    copyFramework: {
      hook: 'Open with the specific financial waste or overpayment the audience currently has.',
      body: 'Current cost (what they\'re spending now) → The gap (where the waste lives) → The switch (how brand eliminates waste) → Evidence (real cost data from real customers).',
      cta: 'Calculate your savings — takes 2 minutes',
      example: "The average SMB pays $1,200/month for 8 separate tools that don't talk to each other.\n\nProject management: $99. Communication: $149. Document storage: $89. Design tool: $79. And so on.\n\nBut more importantly — $400/month in human productivity, manually syncing data between tools that should be integrated.\n\nOur platform replaces all 8 tools for $249/month. Everything connected. One login.\n\nAverage customer saves $950/month — that's $11,400 a year.\n\n→ See if the switch makes sense for your team",
    },
    dos: [
      'Use real, verifiable cost comparisons — fabricated savings claims are illegal',
      'Show the total cost of ownership, not just the sticker price',
      'Quantify the cost of switching (setup time) to build trust',
      'Segment by current solution — "switching from [Competitor]" campaigns convert better',
      'Use a savings calculator tool to personalize the cost-saving estimate',
    ],
    donts: [
      "Don't make comparative price claims without accurate competitor pricing data",
      "Don't use cost-saving messaging for premium products — repositions brand as budget",
      "Don't ignore switching costs — 'save money' without addressing migration is incomplete",
      "Don't present savings that only apply to optimal usage scenarios",
      "Don't forget non-financial costs — cheaper alternatives can cost more in time",
    ],
    bestPractices: [
      'Build a "cost of doing nothing" calculator (opportunity cost framing)',
      'Use competitor conquesting campaigns with cost comparison messaging',
      'Target audiences with budget constraints explicitly (CFO, VP Finance, Owner)',
      'Monthly vs. annual anchoring: show annual savings, charge monthly',
      'Pair cost-saving with quality assurance — "same quality, lower cost" is more credible',
    ],
    mistakes: [
      'Savings claims based on "up to" maximums rather than average case',
      'Comparing to a deliberately overpriced competitor to make savings look larger',
      'Forgetting cost-saving ads attract price-sensitive customers who churn faster',
      'No quality signal alongside the cost claim — purely cheap = commodity positioning',
      'Competing only on price without any differentiation (race to the bottom)',
    ],
    platforms: [
      { platform: 'Google Search', format: 'RSA with price/saving in headline', cta: 'See Pricing / Save Now' },
      { platform: 'Google Shopping', format: 'Product listing with price comparison', cta: 'Direct purchase' },
      { platform: 'Meta/Facebook Feed', format: 'Price comparison or savings calculator (60s)', cta: 'Calculate Your Savings' },
      { platform: 'LinkedIn Sponsored', format: 'Cost reduction case study', cta: 'See the Savings' },
      { platform: 'TikTok', format: '"I switched and saved $X/month" (30s)', cta: 'Link in Bio' },
      { platform: 'YouTube', format: 'Cost breakdown explainer (60–90s)', cta: 'Compare Plans' },
      { platform: 'Pinterest', format: 'Price/value comparison Pin', cta: 'See Pricing' },
    ],
    kpis: [
      { metric: 'CTR', benchmark: '2–5% (high — financial motivation)', indicates: 'Cost pain relevance' },
      { metric: 'Conversion Rate', benchmark: '5–15%', indicates: 'Price sensitivity translation' },
      { metric: 'CPC', benchmark: '$0.50–$2.00', indicates: 'Price-motivated audiences tend to cost less' },
      { metric: 'ROAS', benchmark: '4–8x', indicates: 'High-volume conversion efficiency' },
      { metric: 'Savings Calculator Completions', benchmark: '20–40% of visitors', indicates: 'Intent signal from engagement' },
    ],
    ollamaPrompt: `You are a fintech copywriter. Write a Facebook Cost-Saving ad (max 130 words).
Current cost (audience situation): [CURRENT COST — specific amount or description]
Where the waste is: [SPECIFIC INEFFICIENCY OR OVERPAYMENT]
Brand's price/offer: [BRAND PRICING OR OFFER]
Net savings: [NET SAVING — monthly or annual]
CTA: [CTA TEXT — savings calculator preferred]
Tone: matter-of-fact, financial, credible. Never condescending about past choices.`,
    b2bNote: 'TCO, ROI, budget optimization. LinkedIn/Google priority. Cost audit / savings calculator.',
    b2cNote: 'Value for money, smarter spending. Google Shopping / Meta priority. Coupon / bundle / price-match.',
  },
  {
    key: 'technology_focused',
    name: 'Technology-Focused Ads',
    icon: '🤖',
    psychology: 'Innovation Appeal & FOMO',
    psychologyTrigger: 'Not using latest technology = falling behind competitors — capability expansion creates desire',
    shortDesc: 'Ads about tools, automation, AI, and software capabilities — leading with what the technology does and what new power it gives the audience.',
    headlineFormulas: [
      '[TASK] in [TIMEFRAME] — AI Does It For You Automatically',
      'Meet [BRAND]: The [TECHNOLOGY TYPE] That [SPECIFIC OUTCOME]',
      'How [AUDIENCE] Use [TECHNOLOGY] to [RESULT] 3x Faster',
      '[BRAND]\'s AI [CAPABILITY] — [WHAT IT REPLACES/IMPROVES]',
      'The [INDUSTRY] Tool Built on [TECHNOLOGY] — [SPECIFIC CLAIM]',
    ],
    copyFramework: {
      hook: 'Show the technology in action — a specific task being completed, a result being generated, or a process being automated.',
      body: 'What it does: specific technical capability. How it\'s different: the innovation that makes it uniquely capable. What it replaces or improves upon: the manual process or inferior alternative.',
      cta: 'See [technology] in action — free demo',
      example: "Watch our AI analyze your ad performance and generate optimized copy in 47 seconds.\n\nNot a template. Not fill-in-the-blank. Actual copy, tailored to your audience, your industry, and your campaign history — generated by a model trained on 10 million ad performances.\n\nWhat used to take a copywriter 4 hours now takes under a minute. And it gets smarter with every campaign you run.\n\nOur local AI runs on your infrastructure — no data sent to cloud providers. Your competitive intelligence stays yours.\n\n→ Watch the 90-second demo — no signup required",
    },
    dos: [
      'Show the technology working — demos outperform descriptions every time',
      'Quantify the capability improvement (speed, accuracy, scale)',
      'Address the "is this real?" skepticism with transparent methodology',
      'Demonstrate local/private AI if data privacy is a concern for the audience',
      'Connect the technology to a specific workflow pain the audience recognizes',
    ],
    donts: [
      "Don't use 'AI-powered' without explaining what the AI actually does",
      "Don't show idealized demos that don't reflect real product experience",
      "Don't target non-technical audiences with technical jargon",
      "Don't promise technology capabilities that are not yet production-ready",
      "Don't ignore adoption friction — technical products require onboarding support",
    ],
    bestPractices: [
      'Use real product screen recordings — not polished motion graphics of fake UIs',
      'Include a proof-of-work: real output generated by the tool in the ad',
      'Target technical decision-makers separately from end-users — different messaging',
      'Build a technology comparison page linked from the ad (vs. manual process)',
      'Offer a sandbox/demo environment — technology buyers want to test before buying',
    ],
    mistakes: [
      'Feature list dump without context of why features matter',
      'Technical language that alienates non-technical decision-makers (often the buyer)',
      'Demo video that shows a pristine version of the product, not the real experience',
      'No ROI connection — technology for its own sake doesn\'t drive purchases',
      'Ignoring the change management cost — switching requires more than clicking "buy"',
    ],
    platforms: [
      { platform: 'LinkedIn Sponsored', format: 'Product launch post or demo video', cta: 'Request Demo / Free Trial' },
      { platform: 'YouTube', format: 'Full product walkthrough (90–180s)', cta: 'Start Free Trial' },
      { platform: 'Google Search', format: 'RSA with capability/feature headline', cta: 'See How It Works / Try Free' },
      { platform: 'Meta/Facebook Feed', format: 'Product demo video (60–90s)', cta: 'Watch / Try Free' },
      { platform: 'TikTok', format: '"Watch this AI do [task]" (30–60s)', cta: 'Try Free' },
      { platform: 'Instagram Reel', format: 'Feature spotlight Reel (30–45s)', cta: 'Try It' },
      { platform: 'Twitter/X', format: 'Product demo GIF + thread', cta: 'Try It' },
    ],
    kpis: [
      { metric: 'Demo Watch Rate', benchmark: '40%+ at 60 seconds', indicates: 'Technology interest depth' },
      { metric: 'Free Trial Start', benchmark: '10–25% (from demo CTA)', indicates: 'High-intent technical evaluation' },
      { metric: 'Trial Depth (features used)', benchmark: '3+ features', indicates: 'Adoption vs. surface-level exploration' },
      { metric: 'CTR', benchmark: '1.5–3.5%', indicates: 'Technology curiosity activation' },
      { metric: 'NPS (post-purchase)', benchmark: '40+', indicates: 'Technology promise delivery' },
    ],
    ollamaPrompt: `You are a B2B SaaS copywriter. Write a LinkedIn Technology-Focused ad (max 130 words).
Technology being showcased: [SPECIFIC TECHNOLOGY — name, capability]
What it replaces: [MANUAL PROCESS OR INFERIOR ALTERNATIVE]
Specific capability: [QUANTIFIED PERFORMANCE METRIC — speed, accuracy, scale]
Data privacy / trust angle: [IF APPLICABLE — local AI, no data leaving servers, etc.]
CTA: [CTA — demo/free trial preferred]
Tone: technically credible, outcome-focused, demonstrates expertise. Not hype.`,
    b2bNote: 'Enterprise-grade, security-focused, scalable, ROI-connected. LinkedIn/YouTube/Google priority. Demo/POC.',
    b2cNote: 'Simple, magical, fast, "no tech skills needed". TikTok/Meta/YouTube priority. Free plan / app download.',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface GenerateState {
  loading: boolean;
  result: string;
  error: string;
}

function AdTypePanel({ adType, onClose }: { adType: AdTypeDefinition; onClose: () => void }) {
  const [activeSection, setActiveSection] = useState<'overview' | 'copy' | 'platforms' | 'kpis' | 'ai'>('overview');
  const [gen, setGen] = useState<GenerateState>({ loading: false, result: '', error: '' });

  async function generateWithOllama() {
    setGen({ loading: true, result: '', error: '' });
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt: adType.ollamaPrompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGen({ loading: false, result: '', error: data.error ?? 'Generation failed' });
        return;
      }
      setGen({ loading: false, result: data.text ?? data.content ?? 'No output generated.', error: '' });
    } catch (e) {
      setGen({ loading: false, result: '', error: e instanceof Error ? e.message : 'Failed to reach Ollama' });
    }
  }

  const sectionTabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'copy' as const, label: 'Copy Framework' },
    { id: 'platforms' as const, label: 'Platforms' },
    { id: 'kpis' as const, label: 'KPIs' },
    { id: 'ai' as const, label: 'AI Generate' },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-8 px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mb-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{adType.icon}</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{adType.name}</h2>
              <p className="text-sm text-purple-600 font-medium">{adType.psychology}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            ✕
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 p-2 border-b border-gray-100 overflow-x-auto">
          {sectionTabs.map(t => (
            <button key={t.id} onClick={() => setActiveSection(t.id)}
              className={`flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${activeSection === t.id ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {activeSection === 'overview' && (
            <div className="space-y-5">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-800">
                <p className="font-semibold mb-1">Psychology Trigger</p>
                <p>{adType.psychologyTrigger}</p>
              </div>
              <p className="text-gray-700 text-sm">{adType.shortDesc}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <h3 className="font-semibold text-green-800 mb-2 text-sm">Dos ✅</h3>
                  <ul className="space-y-1">
                    {adType.dos.map((d, i) => <li key={i} className="text-xs text-green-700">• {d}</li>)}
                  </ul>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h3 className="font-semibold text-red-800 mb-2 text-sm">Don&apos;ts ❌</h3>
                  <ul className="space-y-1">
                    {adType.donts.map((d, i) => <li key={i} className="text-xs text-red-700">• {d}</li>)}
                  </ul>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h3 className="font-semibold text-blue-800 mb-2 text-sm">Best Practices</h3>
                  <ul className="space-y-1">
                    {adType.bestPractices.map((d, i) => <li key={i} className="text-xs text-blue-700">• {d}</li>)}
                  </ul>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h3 className="font-semibold text-amber-800 mb-2 text-sm">Common Mistakes</h3>
                  <ul className="space-y-1">
                    {adType.mistakes.map((d, i) => <li key={i} className="text-xs text-amber-700">• {d}</li>)}
                  </ul>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-2 text-sm">B2B vs B2C</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><p className="font-medium text-gray-700 mb-1">B2B</p><p className="text-gray-600">{adType.b2bNote}</p></div>
                  <div><p className="font-medium text-gray-700 mb-1">B2C</p><p className="text-gray-600">{adType.b2cNote}</p></div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'copy' && (
            <div className="space-y-5">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">Headline Formulas</h3>
                <ol className="space-y-2">
                  {adType.headlineFormulas.map((f, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-gray-700 font-mono text-xs bg-gray-50 px-2 py-1 rounded flex-1">{f}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">Copy Framework</h3>
                <div className="space-y-3 text-sm">
                  <div><span className="font-medium text-gray-700">Hook: </span><span className="text-gray-600">{adType.copyFramework.hook}</span></div>
                  <div><span className="font-medium text-gray-700">Body: </span><span className="text-gray-600">{adType.copyFramework.body}</span></div>
                  <div><span className="font-medium text-gray-700">CTA: </span><span className="text-gray-600">{adType.copyFramework.cta}</span></div>
                </div>
              </div>
              <div className="bg-gray-900 rounded-xl p-4">
                <h3 className="font-semibold text-gray-100 mb-3 text-sm">Full Example Ad Copy</h3>
                <pre className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{adType.copyFramework.example}</pre>
              </div>
            </div>
          )}

          {activeSection === 'platforms' && (
            <div className="space-y-3">
              {adType.platforms.map((p, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 grid grid-cols-3 gap-3 text-sm">
                  <div><p className="text-xs text-gray-500 mb-0.5">Platform</p><p className="font-medium text-gray-900">{p.platform}</p></div>
                  <div><p className="text-xs text-gray-500 mb-0.5">Format</p><p className="text-gray-700">{p.format}</p></div>
                  <div><p className="text-xs text-gray-500 mb-0.5">CTA Type</p><p className="text-gray-700">{p.cta}</p></div>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'kpis' && (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Metric', 'Benchmark', 'What It Indicates'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {adType.kpis.map((k, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{k.metric}</td>
                      <td className="px-4 py-3 text-purple-700 font-mono text-xs">{k.benchmark}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{k.indicates}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeSection === 'ai' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                Uses local Ollama (llama3.2) — no data sent to external AI services. Fill in the placeholders in the prompt template before generating.
              </div>
              <div className="bg-gray-900 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-2 font-semibold">OLLAMA PROMPT TEMPLATE</p>
                <pre className="text-xs text-green-300 whitespace-pre-wrap">{adType.ollamaPrompt}</pre>
              </div>
              <button
                onClick={generateWithOllama}
                disabled={gen.loading}
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
              >
                {gen.loading ? 'Generating with llama3.2…' : 'Generate with AI (llama3.2)'}
              </button>
              {gen.error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{gen.error}</div>}
              {gen.result && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-2 font-semibold">AI OUTPUT</p>
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap">{gen.result}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export default function AdTypesLibrary() {
  const [selectedType, setSelectedType] = useState<AdTypeDefinition | null>(null);
  const [search, setSearch] = useState('');

  const filtered = AD_TYPES.filter(t =>
    search === '' ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.psychology.toLowerCase().includes(search.toLowerCase()) ||
    t.shortDesc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Ad Types Library</h2>
        <p className="text-sm text-gray-600">10 proven ad type frameworks — each with headline formulas, copy framework, dos/don&apos;ts, platform recommendations, KPIs, and Ollama AI generation.</p>
      </div>

      {/* Search */}
      <input
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
        placeholder="Search ad types by name, psychology trigger, or description…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(adType => (
          <div
            key={adType.key}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:border-purple-300 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => setSelectedType(adType)}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{adType.icon}</span>
              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">{adType.psychology}</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-1 group-hover:text-purple-700 transition-colors">{adType.name}</h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">{adType.shortDesc.substring(0, 110)}{adType.shortDesc.length > 110 ? '…' : ''}</p>
            <div className="flex gap-2">
              <button className="flex-1 px-3 py-2 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
                View Details
              </button>
              <button
                className="px-3 py-2 text-xs font-medium border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors"
                onClick={e => { e.stopPropagation(); setSelectedType(adType); }}
              >
                Generate with AI
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">
          No ad types match your search.
        </div>
      )}

      {/* Selection Matrix */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-6">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Selection Guide</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Business Goal', 'Best Ad Type', 'Primary Platform', 'Format'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                ['Brand awareness', 'Topic Ads', 'Meta + YouTube', 'Video'],
                ['Lead generation', 'Risk-Based + Value-Focused', 'Google + LinkedIn', 'Search + Sponsored'],
                ['Sales conversion', 'Value-Focused + Cost-Saving', 'Meta + Google', 'Dynamic + Search'],
                ['Thought leadership', 'Knowledge + Best Practices', 'LinkedIn', 'Sponsored Article'],
                ['Re-engagement', 'Mistake-Based', 'Meta', 'Retargeting Carousel'],
                ['Competitive conquesting', 'Cost-Saving + Dos/Don\'ts', 'Google Search', 'Comparison keyword'],
                ['Product launch', 'Technology-Focused', 'LinkedIn + YouTube', 'Demo video'],
                ['Retention/loyalty', 'Value-Focused + Best Practices', 'Email + Meta', 'Story/Carousel'],
                ['Upsell/cross-sell', 'Productivity-Focused + Value', 'Meta + Email', 'Dynamic product'],
                ['Category education', 'Knowledge + Topic', 'YouTube + Instagram', 'Educational video'],
              ].map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {row.map((cell, j) => (
                    <td key={j} className={`px-3 py-2 text-gray-700 ${j === 0 ? 'font-medium' : ''}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel overlay */}
      {selectedType && <AdTypePanel adType={selectedType} onClose={() => setSelectedType(null)} />}
    </div>
  );
}
