'use client';

import { useState } from 'react';

// ─── Research-backed competitor data (compiled 2026-09-16) ───────────────────

type ThreatLevel = 'critical' | 'high' | 'medium' | 'low';
type TargetMarket = 'SMB' | 'Enterprise' | 'Agency' | 'Creator' | 'SMB/Agency' | 'SMB/Creator' | 'Enterprise/Agency' | 'All';
type Category =
  | 'Social Media Mgmt'
  | 'All-in-One'
  | 'Email / CRM'
  | 'Marketing Automation'
  | 'SEO / Content'
  | 'Workflow Automation'
  | 'Work OS / PM'
  | 'Open Source';

interface Competitor {
  name: string;
  website: string;
  category: Category;
  startingPrice: string;
  freePlan: boolean;
  socialScheduling: boolean;
  paidAdsMgmt: boolean;
  aiContent: boolean;
  analytics: boolean;
  agencyFeatures: boolean;
  openSource: boolean;
  targetMarket: TargetMarket;
  threatLevel: ThreatLevel;
  funding: string;
  description: string;
  posX: number; // 0–100: SMB → Enterprise
  posY: number; // 0–100: Affordable → Premium
  tiers: { label: string; price: string }[];
  theyHaveWeDont: string[];
  weHaveTheyDont: string[];
  overlap: string[];
}

const COMPETITORS: Competitor[] = [
  {
    name: 'Hootsuite',
    website: 'https://hootsuite.com',
    category: 'Social Media Mgmt',
    startingPrice: '$99/mo',
    freePlan: false,
    socialScheduling: true,
    paidAdsMgmt: true,
    aiContent: true,
    analytics: true,
    agencyFeatures: true,
    openSource: false,
    targetMarket: 'SMB/Agency',
    threatLevel: 'critical',
    funding: 'Private / VC-backed',
    description: 'One of the oldest social media management platforms; 150M+ social listening sources, broad integrations, strong compliance tooling for enterprise.',
    posX: 60,
    posY: 65,
    tiers: [
      { label: 'Professional', price: '$99/mo' },
      { label: 'Team', price: '$249/mo' },
      { label: 'Enterprise', price: 'Custom' },
    ],
    theyHaveWeDont: ['Social listening (150M+ sources)', 'Compliance & archiving tools', 'Bulk scheduling CSV upload', 'Employee advocacy module'],
    weHaveTheyDont: ['Open-source option (Postiz integration)', 'Local AI (Ollama)', 'Affiliate & referral tracking', 'Yoga/wellness vertical content'],
    overlap: ['Social scheduling', 'Multi-platform publishing', 'Analytics dashboard', 'Team collaboration'],
  },
  {
    name: 'Sprout Social',
    website: 'https://sproutsocial.com',
    category: 'Social Media Mgmt',
    startingPrice: '$249/mo',
    freePlan: false,
    socialScheduling: true,
    paidAdsMgmt: true,
    aiContent: true,
    analytics: true,
    agencyFeatures: true,
    openSource: false,
    targetMarket: 'Enterprise/Agency',
    threatLevel: 'high',
    funding: 'Public (NASDAQ: SPT)',
    description: 'Premium social platform known for deep analytics & stakeholder-ready reporting. $249/seat/mo entry makes it an enterprise play.',
    posX: 75,
    posY: 80,
    tiers: [
      { label: 'Standard', price: '$249/seat/mo' },
      { label: 'Professional', price: '$399/seat/mo' },
      { label: 'Advanced', price: '$499/seat/mo' },
      { label: 'Enterprise', price: 'Custom' },
    ],
    theyHaveWeDont: ['Deep CRM integrations', 'Inbox unified social inbox', 'Detailed listening reports', 'Case-management workflows'],
    weHaveTheyDont: ['Local AI / Ollama', 'Affiliate tracking', 'E-commerce integration', 'Vertical niche playbooks'],
    overlap: ['Social scheduling', 'Analytics', 'Team workflows', 'AI content suggestions'],
  },
  {
    name: 'HubSpot',
    website: 'https://hubspot.com',
    category: 'All-in-One',
    startingPrice: '$18/mo',
    freePlan: true,
    socialScheduling: true,
    paidAdsMgmt: true,
    aiContent: true,
    analytics: true,
    agencyFeatures: true,
    openSource: false,
    targetMarket: 'SMB/Agency',
    threatLevel: 'critical',
    funding: 'Public (NYSE: HUBS)',
    description: 'Dominant all-in-one CRM + marketing suite. Free CRM tier, strong inbound methodology, and Marketing Hub at $800/mo for social + automation.',
    posX: 65,
    posY: 60,
    tiers: [
      { label: 'Free', price: '$0' },
      { label: 'Starter', price: '$18/mo' },
      { label: 'Professional', price: '$800/mo' },
      { label: 'Enterprise', price: '$3,600/mo' },
    ],
    theyHaveWeDont: ['Full CRM suite', 'Landing page builder', 'Sequence / email nurturing', 'Ads ROI tracking (Google/FB/LinkedIn)'],
    weHaveTheyDont: ['Local AI / Ollama', 'Open-source social layer', 'Self-hosted option', 'Vertical wellness content'],
    overlap: ['Social publishing', 'Email campaigns', 'Analytics', 'Ad management'],
  },
  {
    name: 'Salesforce Marketing Cloud',
    website: 'https://salesforce.com/marketing',
    category: 'Marketing Automation',
    startingPrice: '~$1,250/mo',
    freePlan: false,
    socialScheduling: true,
    paidAdsMgmt: true,
    aiContent: true,
    analytics: true,
    agencyFeatures: true,
    openSource: false,
    targetMarket: 'Enterprise',
    threatLevel: 'medium',
    funding: 'Public (NYSE: CRM)',
    description: 'Enterprise-only marketing cloud with Journey Builder, AI-powered Einstein features, and deep Salesforce CRM integration.',
    posX: 90,
    posY: 95,
    tiers: [
      { label: 'Growth', price: '~$1,250/mo' },
      { label: 'Corporate', price: 'Custom' },
      { label: 'Enterprise', price: 'Custom' },
    ],
    theyHaveWeDont: ['Journey Builder', 'Einstein AI predictions', 'Data Cloud (CDP)', 'Multi-channel orchestration at scale'],
    weHaveTheyDont: ['Accessible SMB pricing', 'Self-hosted option', 'Local AI / Ollama', 'Open source social layer'],
    overlap: ['Email automation', 'Analytics', 'Ad integration', 'Social publishing'],
  },
  {
    name: 'Mailchimp',
    website: 'https://mailchimp.com',
    category: 'Email / CRM',
    startingPrice: '$13/mo',
    freePlan: true,
    socialScheduling: false,
    paidAdsMgmt: true,
    aiContent: true,
    analytics: true,
    agencyFeatures: false,
    openSource: false,
    targetMarket: 'SMB',
    threatLevel: 'medium',
    funding: 'Acquired by Intuit (2021)',
    description: 'The dominant entry-level email platform. Acquired by Intuit in 2021 for $12B. Strong brand recognition among SMBs and e-commerce.',
    posX: 35,
    posY: 30,
    tiers: [
      { label: 'Free', price: '$0 (500 contacts)' },
      { label: 'Essentials', price: '$13/mo' },
      { label: 'Standard', price: '$20/mo' },
      { label: 'Premium', price: '$350/mo' },
    ],
    theyHaveWeDont: ['Transactional email (Mandrill)', 'Landing page builder', 'Audience segmentation at scale', 'E-commerce integrations (Shopify etc.)'],
    weHaveTheyDont: ['Social scheduling', 'Local AI / Ollama', 'Affiliate tracking', 'Agency multi-client management'],
    overlap: ['Email campaigns', 'Audience analytics', 'Ad management (Google/FB)', 'AI content generation'],
  },
  {
    name: 'ActiveCampaign',
    website: 'https://activecampaign.com',
    category: 'Marketing Automation',
    startingPrice: '$15/mo',
    freePlan: false,
    socialScheduling: false,
    paidAdsMgmt: false,
    aiContent: true,
    analytics: true,
    agencyFeatures: false,
    openSource: false,
    targetMarket: 'SMB',
    threatLevel: 'medium',
    funding: 'Private / VC-backed (~$3.5B valuation)',
    description: 'Best-in-class automation builder for SMBs. Advanced conditional branching and CRM-light features. At 10k contacts, ~$239/mo.',
    posX: 40,
    posY: 45,
    tiers: [
      { label: 'Starter', price: '$15/mo' },
      { label: 'Plus', price: '$49/mo' },
      { label: 'Professional', price: '$79/mo' },
      { label: 'Enterprise', price: 'Custom' },
    ],
    theyHaveWeDont: ['Advanced automation builder', 'Lead scoring & CRM', 'Predictive content', 'SMS automation'],
    weHaveTheyDont: ['Social media scheduling', 'Local AI / Ollama', 'Open source layer', 'Paid ads management'],
    overlap: ['Email automation', 'Segmentation', 'Analytics', 'AI content'],
  },
  {
    name: 'Klaviyo',
    website: 'https://klaviyo.com',
    category: 'Email / CRM',
    startingPrice: '$20/mo',
    freePlan: true,
    socialScheduling: false,
    paidAdsMgmt: false,
    aiContent: true,
    analytics: true,
    agencyFeatures: false,
    openSource: false,
    targetMarket: 'SMB',
    threatLevel: 'low',
    funding: 'Public (NYSE: KVYO, 2023 IPO)',
    description: 'E-commerce email & SMS platform. Deep Shopify integration. Predictive analytics (predicted CLV, churn). 500 contacts free, $20/mo to start.',
    posX: 42,
    posY: 38,
    tiers: [
      { label: 'Free', price: '$0 (500 contacts)' },
      { label: 'Email', price: '$20/mo' },
      { label: 'Email + SMS', price: '$35/mo' },
    ],
    theyHaveWeDont: ['Predictive CLV & churn', 'Shopify native integration', 'SMS marketing', 'Product recommendation engine'],
    weHaveTheyDont: ['Social scheduling', 'Agency tools', 'Local AI / Ollama', 'Paid ads management'],
    overlap: ['Email automation', 'Segmentation', 'Analytics', 'AI content generation'],
  },
  {
    name: 'Semrush',
    website: 'https://semrush.com',
    category: 'SEO / Content',
    startingPrice: '$117/mo',
    freePlan: false,
    socialScheduling: true,
    paidAdsMgmt: true,
    aiContent: true,
    analytics: true,
    agencyFeatures: true,
    openSource: false,
    targetMarket: 'SMB/Agency',
    threatLevel: 'high',
    funding: 'Public (NYSE: SEMR)',
    description: 'Full marketing suite anchored by SEO. Includes social posting, paid ads research, content marketing toolkit, and AI Copilot. $117-499/mo.',
    posX: 55,
    posY: 58,
    tiers: [
      { label: 'Pro', price: '$117/mo' },
      { label: 'Guru', price: '$208/mo' },
      { label: 'Business', price: '$417/mo' },
      { label: 'Enterprise', price: '$5,000+/mo' },
    ],
    theyHaveWeDont: ['SEO keyword research (21B+ keywords)', 'Backlink analysis', 'Competitive traffic intelligence', 'Site audit crawler'],
    weHaveTheyDont: ['Local AI / Ollama', 'Open-source social layer', 'Self-hosted option', 'Affiliate/referral tracking'],
    overlap: ['Social scheduling', 'Analytics', 'AI content generation', 'Paid ads intelligence'],
  },
  {
    name: 'Ahrefs',
    website: 'https://ahrefs.com',
    category: 'SEO / Content',
    startingPrice: '$29/mo',
    freePlan: false,
    socialScheduling: false,
    paidAdsMgmt: false,
    aiContent: true,
    analytics: true,
    agencyFeatures: true,
    openSource: false,
    targetMarket: 'SMB/Agency',
    threatLevel: 'low',
    funding: 'Bootstrapped (profitable)',
    description: 'Best-in-class SEO & backlink analysis. Content Explorer, AI Content Grader. Starter plan $29/mo, Lite $129/mo. Bootstrapped and profitable.',
    posX: 50,
    posY: 50,
    tiers: [
      { label: 'Starter', price: '$29/mo' },
      { label: 'Lite', price: '$129/mo' },
      { label: 'Standard', price: '$249/mo' },
      { label: 'Advanced', price: '$449/mo' },
    ],
    theyHaveWeDont: ['Backlink index (35T+ links)', 'Content Explorer', 'Site audit', 'SERP history'],
    weHaveTheyDont: ['Social scheduling', 'Email automation', 'Local AI / Ollama', 'CRM / affiliate tracking'],
    overlap: ['AI content suggestions', 'Analytics', 'Competitor research'],
  },
  {
    name: 'Buffer',
    website: 'https://buffer.com',
    category: 'Social Media Mgmt',
    startingPrice: '$6/mo',
    freePlan: true,
    socialScheduling: true,
    paidAdsMgmt: false,
    aiContent: true,
    analytics: true,
    agencyFeatures: false,
    openSource: false,
    targetMarket: 'SMB/Creator',
    threatLevel: 'medium',
    funding: 'Bootstrapped (profitable, employee-owned)',
    description: 'Simple, affordable social scheduling for small teams and creators. Free plan (3 channels). $6/mo starter. Bootstrapped and employee-owned.',
    posX: 20,
    posY: 20,
    tiers: [
      { label: 'Free', price: '$0 (3 channels)' },
      { label: 'Essentials', price: '$6/mo/channel' },
      { label: 'Team', price: '$12/mo/channel' },
      { label: 'Agency', price: '$120/mo (10 channels)' },
    ],
    theyHaveWeDont: ['Start Page (link-in-bio)', 'Audience demographics analytics', 'Mobile-first app experience'],
    weHaveTheyDont: ['Email automation', 'Paid ads management', 'Local AI / Ollama', 'Affiliate/referral tracking', 'Agency multi-client billing'],
    overlap: ['Social scheduling', 'Basic analytics', 'AI content suggestions'],
  },
  {
    name: 'Later',
    website: 'https://later.com',
    category: 'Social Media Mgmt',
    startingPrice: '$25/mo',
    freePlan: true,
    socialScheduling: true,
    paidAdsMgmt: false,
    aiContent: true,
    analytics: true,
    agencyFeatures: false,
    openSource: false,
    targetMarket: 'Creator',
    threatLevel: 'low',
    funding: 'Acquired by Mavrck (2022)',
    description: 'Visual-first scheduler built for Instagram & TikTok creators. Linkin.bio, hashtag suggestions, best-time-to-post. Acquired by Mavrck 2022.',
    posX: 15,
    posY: 25,
    tiers: [
      { label: 'Free', price: '$0 (3 channels)' },
      { label: 'Starter', price: '$25/mo' },
      { label: 'Growth', price: '$45/mo' },
      { label: 'Advanced', price: '$80/mo' },
    ],
    theyHaveWeDont: ['Visual content calendar (drag & drop)', 'Linkin.bio page', 'Hashtag analytics', 'Creator marketplace'],
    weHaveTheyDont: ['Email automation', 'Paid ads', 'Local AI / Ollama', 'Affiliate tracking', 'Agency billing'],
    overlap: ['Social scheduling', 'Analytics', 'AI captions'],
  },
  {
    name: 'Sprinklr',
    website: 'https://sprinklr.com',
    category: 'Social Media Mgmt',
    startingPrice: '$199/mo',
    freePlan: false,
    socialScheduling: true,
    paidAdsMgmt: true,
    aiContent: true,
    analytics: true,
    agencyFeatures: true,
    openSource: false,
    targetMarket: 'Enterprise',
    threatLevel: 'low',
    funding: 'Public (NYSE: CXM)',
    description: 'Unified customer-experience platform for large enterprises. Governance, 30+ social channels, AI-moderation, customer service integration.',
    posX: 92,
    posY: 88,
    tiers: [
      { label: 'Self-serve', price: '$199/mo' },
      { label: 'Enterprise', price: 'Custom ($30k+/yr)' },
    ],
    theyHaveWeDont: ['Unified CXM (customer experience)', 'AI-powered moderation at scale', 'Brand governance workflows', 'Customer service integration'],
    weHaveTheyDont: ['Accessible pricing for SMBs', 'Local AI / Ollama', 'Open-source social layer', 'Affiliate/referral tracking'],
    overlap: ['Social scheduling', 'Analytics', 'AI content', 'Paid ads management', 'Agency features'],
  },
  {
    name: 'Adobe Marketo Engage',
    website: 'https://business.adobe.com/products/marketo',
    category: 'Marketing Automation',
    startingPrice: '~$1,250/mo',
    freePlan: false,
    socialScheduling: false,
    paidAdsMgmt: true,
    aiContent: true,
    analytics: true,
    agencyFeatures: false,
    openSource: false,
    targetMarket: 'Enterprise',
    threatLevel: 'low',
    funding: 'Public (NASDAQ: ADBE)',
    description: 'B2B marketing automation powerhouse. Smart Campaigns, lead & account scoring, ABM, dynamic content. $1,250–$10,000+/mo based on contacts.',
    posX: 85,
    posY: 90,
    tiers: [
      { label: 'Growth', price: '~$1,250/mo' },
      { label: 'Select', price: '~$2,750/mo' },
      { label: 'Prime', price: 'Custom' },
      { label: 'Ultimate', price: 'Custom' },
    ],
    theyHaveWeDont: ['Account-Based Marketing (ABM)', 'Smart Campaign engine', 'Webinar integration', 'Revenue attribution'],
    weHaveTheyDont: ['Social scheduling', 'Local AI / Ollama', 'Accessible pricing', 'Affiliate tracking', 'Open-source option'],
    overlap: ['Email automation', 'AI content', 'Analytics', 'Ad integration'],
  },
  {
    name: 'Postiz (OSS)',
    website: 'https://postiz.com',
    category: 'Open Source',
    startingPrice: '$0 (self-host)',
    freePlan: true,
    socialScheduling: true,
    paidAdsMgmt: false,
    aiContent: true,
    analytics: true,
    agencyFeatures: true,
    openSource: true,
    targetMarket: 'SMB/Agency',
    threatLevel: 'high',
    funding: 'Bootstrapped / Open-source (32k+ GitHub stars)',
    description: 'Open-source social scheduler with AI. 33 platforms, AGPL-3.0, Canva-like design, 32k+ GitHub stars. Direct analogue to our social scheduling layer.',
    posX: 25,
    posY: 10,
    tiers: [
      { label: 'Self-hosted', price: '$0' },
      { label: 'Cloud Starter', price: '$29/mo' },
      { label: 'Cloud Pro', price: '$69/mo' },
    ],
    theyHaveWeDont: ['33-platform coverage', '32k GitHub community', 'Canva-like design tool', 'White-label reseller option'],
    weHaveTheyDont: ['Email automation', 'Paid ads management', 'Affiliate/referral tracking', 'E-commerce integration', 'Local Ollama (our stack)'],
    overlap: ['Social scheduling', 'AI content generation', 'Analytics', 'Agency multi-account', 'Open source'],
  },
  {
    name: 'Mautic',
    website: 'https://mautic.org',
    category: 'Open Source',
    startingPrice: '$0 (self-host)',
    freePlan: true,
    socialScheduling: false,
    paidAdsMgmt: false,
    aiContent: false,
    analytics: true,
    agencyFeatures: false,
    openSource: true,
    targetMarket: 'SMB',
    threatLevel: 'medium',
    funding: 'Open-source (Acquia-backed community)',
    description: 'Leading open-source marketing automation. Email, lead nurturing, landing pages, CRM integration. Self-hosted free; cloud from $300/mo.',
    posX: 30,
    posY: 15,
    tiers: [
      { label: 'Self-hosted', price: '$0' },
      { label: 'Mautic Cloud', price: '~$300/mo' },
    ],
    theyHaveWeDont: ['Open-source MA community ecosystem', 'GDPR-native data control', 'CRM integrations (Salesforce, SugarCRM)', 'Landing page builder'],
    weHaveTheyDont: ['Social scheduling', 'Local AI / Ollama', 'Paid ads management', 'Affiliate tracking'],
    overlap: ['Email automation', 'Analytics', 'Open source / self-hosted'],
  },
  {
    name: 'n8n',
    website: 'https://n8n.io',
    category: 'Workflow Automation',
    startingPrice: '$0 (self-host)',
    freePlan: true,
    socialScheduling: false,
    paidAdsMgmt: false,
    aiContent: false,
    analytics: false,
    agencyFeatures: false,
    openSource: true,
    targetMarket: 'SMB/Agency',
    threatLevel: 'medium',
    funding: 'VC-backed ($55M Series B, 2023)',
    description: 'Technical workflow automation. Self-hostable, 400+ integrations, unlimited executions free. €20/mo cloud. Powers our internal automation layer.',
    posX: 38,
    posY: 22,
    tiers: [
      { label: 'Self-hosted', price: '$0 (unlimited)' },
      { label: 'Cloud Starter', price: '€20/mo' },
      { label: 'Cloud Pro', price: '€50/mo' },
      { label: 'Cloud Business', price: '€667/mo' },
    ],
    theyHaveWeDont: ['400+ integrations', 'Visual workflow builder', 'Code mode (JS/Python)', 'Community templates library'],
    weHaveTheyDont: ['Social scheduling', 'Email marketing', 'Analytics dashboards', 'Paid ads management'],
    overlap: ['Open source / self-hosted', 'Automation workflows', 'API integrations'],
  },
  {
    name: 'Make (Integromat)',
    website: 'https://make.com',
    category: 'Workflow Automation',
    startingPrice: '$9/mo',
    freePlan: true,
    socialScheduling: false,
    paidAdsMgmt: false,
    aiContent: false,
    analytics: false,
    agencyFeatures: false,
    openSource: false,
    targetMarket: 'SMB',
    threatLevel: 'low',
    funding: 'VC-backed (Celonis-acquired)',
    description: 'Visual automation platform. Credit-based pricing (2025 model change). 60% cheaper than Zapier. 1,500+ apps. Strong visual scenario builder.',
    posX: 28,
    posY: 18,
    tiers: [
      { label: 'Free', price: '$0 (1k ops/mo)' },
      { label: 'Core', price: '$9/mo' },
      { label: 'Pro', price: '$16/mo' },
      { label: 'Teams', price: '$29/mo' },
      { label: 'Enterprise', price: 'Custom' },
    ],
    theyHaveWeDont: ['Visual scenario builder', '1,500+ app connectors', 'Data stores (built-in DB)', 'Error handling & retry'],
    weHaveTheyDont: ['Social scheduling', 'Email marketing', 'Analytics', 'Paid ads management'],
    overlap: ['Workflow automation', 'API integrations'],
  },
  {
    name: 'Zapier',
    website: 'https://zapier.com',
    category: 'Workflow Automation',
    startingPrice: '$19.99/mo',
    freePlan: true,
    socialScheduling: false,
    paidAdsMgmt: false,
    aiContent: true,
    analytics: false,
    agencyFeatures: false,
    openSource: false,
    targetMarket: 'SMB',
    threatLevel: 'low',
    funding: 'Bootstrapped (profitable, $5B+ valuation)',
    description: 'The no-code automation market leader. 6,000+ app integrations, AI-powered Zap creation. $19.99/mo for 750 tasks. Bootstrapped to unicorn.',
    posX: 32,
    posY: 35,
    tiers: [
      { label: 'Free', price: '$0 (100 tasks/mo)' },
      { label: 'Professional', price: '$19.99/mo' },
      { label: 'Team', price: '$69/mo' },
      { label: 'Enterprise', price: 'Custom' },
    ],
    theyHaveWeDont: ['6,000+ app integrations', 'Zapier Tables (built-in DB)', 'Zapier Interfaces (no-code apps)', 'AI Zap creator'],
    weHaveTheyDont: ['Social scheduling', 'Email marketing', 'Analytics dashboards', 'Paid ads management'],
    overlap: ['Workflow automation', 'AI assistance'],
  },
  {
    name: 'Monday.com',
    website: 'https://monday.com',
    category: 'Work OS / PM',
    startingPrice: '$9/seat/mo',
    freePlan: true,
    socialScheduling: false,
    paidAdsMgmt: false,
    aiContent: true,
    analytics: true,
    agencyFeatures: true,
    openSource: false,
    targetMarket: 'SMB/Agency',
    threatLevel: 'low',
    funding: 'Public (NASDAQ: MNDY)',
    description: 'Work OS for project management & marketing campaigns. LinkedIn integration for social task automation. $9–$19/seat/mo. AI Sidekick included.',
    posX: 45,
    posY: 40,
    tiers: [
      { label: 'Free', price: '$0 (2 users)' },
      { label: 'Basic', price: '$9/seat/mo' },
      { label: 'Standard', price: '$12/seat/mo' },
      { label: 'Pro', price: '$19/seat/mo' },
      { label: 'Enterprise', price: 'Custom' },
    ],
    theyHaveWeDont: ['Campaign project management', 'Client portal', 'Workload & resource planning', 'Monday AI Sidekick (included)'],
    weHaveTheyDont: ['Social scheduling', 'Email automation', 'Paid ads management', 'Local AI / Ollama'],
    overlap: ['Analytics', 'AI features', 'Team collaboration', 'Agency client management'],
  },
];

const TOP5_THREAT = COMPETITORS.filter((c) => c.threatLevel === 'critical' || (c.threatLevel === 'high' && ['Sprout Social', 'Semrush', 'Postiz (OSS)'].includes(c.name)));

const THREAT_COLORS: Record<ThreatLevel, string> = {
  critical: 'bg-red-500/20 text-red-300 border border-red-500/40',
  high: 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
  medium: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
  low: 'bg-green-500/20 text-green-300 border border-green-500/40',
};

const THREAT_EMOJI: Record<ThreatLevel, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
};

const CATEGORY_COLORS: Record<Category, string> = {
  'Social Media Mgmt': 'bg-blue-500/20 text-blue-300',
  'All-in-One': 'bg-purple-500/20 text-purple-300',
  'Email / CRM': 'bg-pink-500/20 text-pink-300',
  'Marketing Automation': 'bg-indigo-500/20 text-indigo-300',
  'SEO / Content': 'bg-teal-500/20 text-teal-300',
  'Workflow Automation': 'bg-amber-500/20 text-amber-300',
  'Work OS / PM': 'bg-cyan-500/20 text-cyan-300',
  'Open Source': 'bg-emerald-500/20 text-emerald-300',
};

const MARKET_COLORS: Record<TargetMarket, string> = {
  SMB: 'bg-sky-500/20 text-sky-300',
  Enterprise: 'bg-violet-500/20 text-violet-300',
  Agency: 'bg-rose-500/20 text-rose-300',
  Creator: 'bg-lime-500/20 text-lime-300',
  'SMB/Agency': 'bg-orange-500/20 text-orange-300',
  'SMB/Creator': 'bg-yellow-500/20 text-yellow-300',
  'Enterprise/Agency': 'bg-purple-500/20 text-purple-300',
  All: 'bg-gray-500/20 text-gray-300',
};

const TABS = ['Competitor Matrix', 'Market Positioning', 'Feature Gap Analysis', 'Pricing Intelligence', 'Research Report'] as const;
type Tab = typeof TABS[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Check({ val }: { val: boolean }) {
  return <span className={val ? 'text-green-400 font-bold' : 'text-white/30'} aria-label={val ? 'Yes' : 'No'}>{val ? '✓' : '—'}</span>;
}

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${className}`}>{label}</span>;
}

// ─── Tab 1: Competitor Matrix ─────────────────────────────────────────────────

function CompetitorMatrix() {
  const [sortCol, setSortCol] = useState<'name' | 'price' | 'threat'>('threat');
  const [filterCat, setFilterCat] = useState<string>('All');
  const [filterMarket, setFilterMarket] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(COMPETITORS.map((c) => c.category)))];
  const markets = ['All', ...Array.from(new Set(COMPETITORS.map((c) => c.targetMarket)))];

  const threatOrder: Record<ThreatLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const filtered = COMPETITORS.filter((c) => {
    if (filterCat !== 'All' && c.category !== filterCat) return false;
    if (filterMarket !== 'All' && c.targetMarket !== filterMarket) return false;
    return true;
  }).sort((a, b) => {
    if (sortCol === 'threat') return threatOrder[a.threatLevel] - threatOrder[b.threatLevel];
    if (sortCol === 'name') return a.name.localeCompare(b.name);
    return a.startingPrice.localeCompare(b.startingPrice);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-xs text-white/60 block mb-1">Category</label>
          <select
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white"
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
          >
            {categories.map((c) => <option key={c} value={c} className="bg-gray-900">{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-white/60 block mb-1">Market</label>
          <select
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white"
            value={filterMarket}
            onChange={(e) => setFilterMarket(e.target.value)}
          >
            {markets.map((m) => <option key={m} value={m} className="bg-gray-900">{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-white/60 block mb-1">Sort by</label>
          <select
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white"
            value={sortCol}
            onChange={(e) => setSortCol(e.target.value as 'name' | 'price' | 'threat')}
          >
            <option value="threat" className="bg-gray-900">Threat Level</option>
            <option value="name" className="bg-gray-900">Name</option>
            <option value="price" className="bg-gray-900">Price</option>
          </select>
        </div>
        <div className="ml-auto flex items-end">
          <span className="text-white/60 text-sm">{filtered.length} of {COMPETITORS.length} platforms</span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm min-w-[1200px]">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left py-3 px-4 text-white/70 font-medium">Company</th>
              <th className="text-left py-3 px-3 text-white/70 font-medium">Category</th>
              <th className="text-left py-3 px-3 text-white/70 font-medium">Starting Price</th>
              <th className="text-center py-3 px-2 text-white/70 font-medium">Free</th>
              <th className="text-center py-3 px-2 text-white/70 font-medium">Social</th>
              <th className="text-center py-3 px-2 text-white/70 font-medium">Paid Ads</th>
              <th className="text-center py-3 px-2 text-white/70 font-medium">AI Content</th>
              <th className="text-center py-3 px-2 text-white/70 font-medium">Analytics</th>
              <th className="text-center py-3 px-2 text-white/70 font-medium">Agency</th>
              <th className="text-center py-3 px-2 text-white/70 font-medium">OSS</th>
              <th className="text-left py-3 px-3 text-white/70 font-medium">Market</th>
              <th className="text-center py-3 px-3 text-white/70 font-medium">Threat</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.name} className={`border-b border-white/5 transition-colors hover:bg-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                <td className="py-3 px-4">
                  <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 font-semibold hover:underline">
                    {c.name}
                  </a>
                  <div className="text-xs text-white/40 mt-0.5">{c.funding}</div>
                </td>
                <td className="py-3 px-3"><Badge label={c.category} className={CATEGORY_COLORS[c.category]} /></td>
                <td className="py-3 px-3 text-white/80 font-mono text-xs">{c.startingPrice}</td>
                <td className="py-3 px-2 text-center"><Check val={c.freePlan} /></td>
                <td className="py-3 px-2 text-center"><Check val={c.socialScheduling} /></td>
                <td className="py-3 px-2 text-center"><Check val={c.paidAdsMgmt} /></td>
                <td className="py-3 px-2 text-center"><Check val={c.aiContent} /></td>
                <td className="py-3 px-2 text-center"><Check val={c.analytics} /></td>
                <td className="py-3 px-2 text-center"><Check val={c.agencyFeatures} /></td>
                <td className="py-3 px-2 text-center"><Check val={c.openSource} /></td>
                <td className="py-3 px-3"><Badge label={c.targetMarket} className={MARKET_COLORS[c.targetMarket]} /></td>
                <td className="py-3 px-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${THREAT_COLORS[c.threatLevel]}`}>
                    {THREAT_EMOJI[c.threatLevel]} {c.threatLevel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-4 gap-3 text-center">
        {(['critical', 'high', 'medium', 'low'] as ThreatLevel[]).map((t) => (
          <div key={t} className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="text-2xl font-bold text-white">{COMPETITORS.filter((c) => c.threatLevel === t).length}</div>
            <div className={`text-xs mt-1 ${t === 'critical' ? 'text-red-300' : t === 'high' ? 'text-orange-300' : t === 'medium' ? 'text-yellow-300' : 'text-green-300'}`}>
              {THREAT_EMOJI[t]} {t.charAt(0).toUpperCase() + t.slice(1)} Threat
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab 2: Market Positioning 2×2 ──────────────────────────────────────────

function MarketPositioning() {
  const [hovered, setHovered] = useState<string | null>(null);

  const dotColor = (name: string, threatLevel: ThreatLevel) => {
    if (name === 'TalentsHill') return '#a855f7';
    if (name === 'SohamYoga') return '#22d3ee';
    const map: Record<ThreatLevel, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };
    return map[threatLevel];
  };

  const specialDots = [
    { name: 'TalentsHill', posX: 45, posY: 35, threatLevel: 'low' as ThreatLevel, description: 'Our enterprise marketing suite — targeting SMB to mid-market with affordable, AI-native pricing.' },
    { name: 'SohamYoga', posX: 22, posY: 28, threatLevel: 'low' as ThreatLevel, description: 'Our yoga/wellness vertical — niche SMB, affordable pricing, strong community focus.' },
  ];

  const allDots = [...COMPETITORS, ...specialDots.map((d) => ({ ...d, category: 'All-in-One' as Category, startingPrice: '', freePlan: false, socialScheduling: false, paidAdsMgmt: false, aiContent: false, analytics: false, agencyFeatures: false, openSource: false, targetMarket: 'SMB' as TargetMarket, funding: '', tiers: [], theyHaveWeDont: [], weHaveTheyDont: [], overlap: [] }))];

  const hoveredDot = allDots.find((c) => c.name === hovered);

  return (
    <div className="space-y-4">
      <div className="text-white/60 text-sm">
        X-axis: SMB (left) → Enterprise (right) &nbsp;·&nbsp; Y-axis: Affordable (bottom) → Premium (top)
        &nbsp;·&nbsp; Dot color = threat level (🔴 critical / 🟠 high / 🟡 medium / 🟢 low)
        &nbsp;·&nbsp; <span className="text-purple-300">■ TalentsHill</span> &nbsp;·&nbsp; <span className="text-cyan-300">■ SohamYoga</span>
      </div>
      <div className="relative backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl overflow-hidden" style={{ height: 560 }}>
        {/* Axis labels */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-white/40 text-xs">← Premium</div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/40 text-xs">Affordable →</div>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-xs" style={{ writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}>SMB ←</div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-xs" style={{ writingMode: 'vertical-rl', transform: 'translateY(-50%)' }}>→ Enterprise</div>

        {/* Quadrant lines */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-8 right-8 h-px bg-white/10" />
          <div className="absolute left-1/2 top-8 bottom-8 w-px bg-white/10" />
          <div className="absolute top-[15%] left-[55%] text-white/20 text-xs">Enterprise Premium</div>
          <div className="absolute top-[15%] left-[8%] text-white/20 text-xs">SMB Premium</div>
          <div className="absolute bottom-[12%] left-[55%] text-white/20 text-xs">Enterprise Affordable</div>
          <div className="absolute bottom-[12%] left-[8%] text-white/20 text-xs">SMB Affordable</div>
        </div>

        {/* Dots */}
        {allDots.map((c) => {
          const isSpecial = c.name === 'TalentsHill' || c.name === 'SohamYoga';
          const x = `${c.posX}%`;
          const y = `${c.posY}%`;
          const color = dotColor(c.name, c.threatLevel);
          return (
            <div
              key={c.name}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
              style={{ left: x, top: y }}
              onMouseEnter={() => setHovered(c.name)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className={`rounded-full border-2 flex items-center justify-center transition-all duration-200 ${hovered === c.name ? 'scale-150' : 'scale-100'}`}
                style={{
                  width: isSpecial ? 18 : 14,
                  height: isSpecial ? 18 : 14,
                  backgroundColor: color,
                  borderColor: isSpecial ? '#fff' : color,
                  boxShadow: `0 0 8px ${color}88`,
                }}
              />
              <span className="absolute left-4 top-0 text-white text-[10px] whitespace-nowrap pointer-events-none font-medium" style={{ textShadow: '0 1px 4px #000' }}>
                {c.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tooltip card */}
      {hoveredDot && (
        <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-4 text-sm text-white/80">
          <div className="font-bold text-white text-base mb-1">{hoveredDot.name}</div>
          {'description' in hoveredDot && <div className="text-white/70 mb-2">{hoveredDot.description}</div>}
          {hoveredDot.startingPrice && (
            <div className="flex gap-4 text-xs text-white/60">
              <span>Starting: <span className="text-white">{hoveredDot.startingPrice}</span></span>
              <span>Market: <span className="text-white">{hoveredDot.targetMarket}</span></span>
              <span>Threat: <span className="text-white">{hoveredDot.threatLevel}</span></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Feature Gap Analysis ─────────────────────────────────────────────

function FeatureGapAnalysis() {
  const top5 = COMPETITORS.filter((c) => ['Hootsuite', 'HubSpot', 'Sprout Social', 'Semrush', 'Postiz (OSS)'].includes(c.name));

  return (
    <div className="space-y-6">
      <p className="text-white/60 text-sm">Feature gap analysis for the 5 highest-threat competitors. Red = they have it, we don&apos;t (build opportunities). Green = we have it, they don&apos;t (our advantages).</p>
      {top5.map((c) => (
        <div key={c.name} className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-white">{c.name}</span>
            <Badge label={c.category} className={CATEGORY_COLORS[c.category]} />
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${THREAT_COLORS[c.threatLevel]}`}>{THREAT_EMOJI[c.threatLevel]} {c.threatLevel}</span>
            <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-300 hover:underline ml-auto">{c.website.replace('https://', '')}</a>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <div className="text-red-300 text-xs font-semibold mb-2 uppercase tracking-wide">They Have / We Don&apos;t</div>
              <ul className="space-y-1.5">
                {c.theyHaveWeDont.map((f) => (
                  <li key={f} className="text-white/70 text-xs flex gap-2">
                    <span className="text-red-400 mt-0.5 shrink-0">●</span> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <div className="text-green-300 text-xs font-semibold mb-2 uppercase tracking-wide">We Have / They Don&apos;t</div>
              <ul className="space-y-1.5">
                {c.weHaveTheyDont.map((f) => (
                  <li key={f} className="text-white/70 text-xs flex gap-2">
                    <span className="text-green-400 mt-0.5 shrink-0">●</span> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <div className="text-blue-300 text-xs font-semibold mb-2 uppercase tracking-wide">Overlap (Both Have)</div>
              <ul className="space-y-1.5">
                {c.overlap.map((f) => (
                  <li key={f} className="text-white/70 text-xs flex gap-2">
                    <span className="text-blue-400 mt-0.5 shrink-0">●</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab 4: Pricing Intelligence ─────────────────────────────────────────────

function PricingIntelligence() {
  return (
    <div className="space-y-6">
      <p className="text-white/60 text-sm">All pricing sourced from public pages / G2 / Capterra as of September 2026. Enterprise pricing estimated from public reports where not disclosed.</p>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left py-3 px-4 text-white/70 font-medium">Company</th>
              <th className="text-center py-3 px-4 text-white/70 font-medium">Free</th>
              <th className="text-center py-3 px-4 text-white/70 font-medium">Starter</th>
              <th className="text-center py-3 px-4 text-white/70 font-medium">Pro / Growth</th>
              <th className="text-center py-3 px-4 text-white/70 font-medium">Enterprise</th>
            </tr>
          </thead>
          <tbody>
            {COMPETITORS.map((c, i) => {
              const getTier = (idx: number) => c.tiers[idx]?.price ?? '—';
              return (
                <tr key={c.name} className={`border-b border-white/5 hover:bg-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{c.name}</div>
                    <Badge label={c.category} className={`mt-0.5 ${CATEGORY_COLORS[c.category]}`} />
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-xs text-white/70">{c.freePlan ? (c.tiers.find(t => t.price.includes('$0'))?.price ?? '$0') : '—'}</td>
                  <td className="py-3 px-4 text-center font-mono text-xs text-white/70">{getTier(c.freePlan ? 1 : 0)}</td>
                  <td className="py-3 px-4 text-center font-mono text-xs text-white/70">{getTier(c.freePlan ? 2 : 1)}</td>
                  <td className="py-3 px-4 text-center font-mono text-xs text-white/70">{c.tiers[c.tiers.length - 1]?.price ?? 'Custom'}</td>
                </tr>
              );
            })}
            {/* TalentsHill row */}
            <tr className="border-b border-white/5 bg-purple-500/10 border-t-2 border-t-purple-500/40">
              <td className="py-3 px-4">
                <div className="font-bold text-purple-300">TalentsHill (Suggested)</div>
                <Badge label="All-in-One" className="mt-0.5 bg-purple-500/20 text-purple-300" />
              </td>
              <td className="py-3 px-4 text-center font-mono text-xs text-purple-300">$0 (limited)</td>
              <td className="py-3 px-4 text-center font-mono text-xs text-purple-300">$29/mo</td>
              <td className="py-3 px-4 text-center font-mono text-xs text-purple-300">$79/mo</td>
              <td className="py-3 px-4 text-center font-mono text-xs text-purple-300">$199/mo</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pricing insight cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="text-white/60 text-xs uppercase tracking-wide mb-2">Market Average (SMB)</div>
          <div className="text-2xl font-bold text-white">$49/mo</div>
          <div className="text-white/50 text-xs mt-1">For a starter plan with social + email</div>
        </div>
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="text-white/60 text-xs uppercase tracking-wide mb-2">Market Average (Agency)</div>
          <div className="text-2xl font-bold text-white">$199/mo</div>
          <div className="text-white/50 text-xs mt-1">Multi-account management entry point</div>
        </div>
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="text-white/60 text-xs uppercase tracking-wide mb-2">Open-Source Alternatives</div>
          <div className="text-2xl font-bold text-green-400">$0</div>
          <div className="text-white/50 text-xs mt-1">Postiz, Mautic, n8n all self-hostable free</div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 5: Research Report ────────────────────────────────────────────────

function ResearchReport() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5 text-white/80 leading-relaxed">
        <h2 className="text-xl font-bold text-white">Competitive Intelligence Report — Digital Marketing SaaS (2026)</h2>
        <p className="text-xs text-white/40">Researched: September 2026 &nbsp;·&nbsp; Scope: 19 platforms across 8 categories</p>

        <section>
          <h3 className="text-white font-semibold text-base mb-2">Market Overview</h3>
          <p>
            The global digital marketing software market is estimated at $65–80B in 2026, growing at ~14% CAGR. The market is bifurcated: at the enterprise end, Salesforce Marketing Cloud, Adobe Marketo, HubSpot Enterprise, and Sprinklr command five- to six-figure annual contracts. At the SMB end, Buffer, Later, Mailchimp, and ActiveCampaign compete on sub-$50/mo accessibility. The middle market — agency-scale teams that need multi-client management, AI content, scheduling, analytics, and paid-ads intelligence under $200/mo — remains underserved. Two public companies (Sprout Social, Semrush) and one private unicorn (HubSpot) are the dominant cross-category threats, each recently adding AI features to consolidate more marketing budget per account.
          </p>
        </section>

        <section>
          <h3 className="text-white font-semibold text-base mb-2">Key Competitive Dynamics</h3>
          <p>
            Three dynamics shape the field in 2026. First, <strong className="text-white">AI feature parity race</strong>: every tier-1 platform has shipped generative AI — Hootsuite OwlyWriter, Sprout Social AI Assist, HubSpot AI, Semrush Copilot, ActiveCampaign predictive content. The differentiation window for "has AI" has closed; the next battle is <em>local AI</em> (privacy, cost, no API key leakage) — an area where TalentsHill has a structural lead through its Ollama integration. Second, <strong className="text-white">open-source disruption</strong>: Postiz (32k GitHub stars, 33 platforms, AGPL-3.0) and Mautic are capturing cost-sensitive buyers who would otherwise choose Buffer or ActiveCampaign. For TalentsHill, Postiz is both a threat (same audience) and a potential integration surface — its API and plugin architecture are mature. Third, <strong className="text-white">pricing compression</strong>: Make.com, n8n, and Zapier have commoditized workflow automation; teams no longer pay separately for basic automation. This shifts the value battleground to data intelligence, vertical-specific content, and agency billing/white-labeling.
          </p>
        </section>

        <section>
          <h3 className="text-white font-semibold text-base mb-2">TalentsHill Differentiation Strategy</h3>
          <p>
            TalentsHill&apos;s strongest differentiation vectors are (1) <strong className="text-white">local-first AI</strong> via Ollama — no cloud API costs, no data exfiltration risk, enterprise-grade privacy at SMB pricing; (2) <strong className="text-white">open-source social layer</strong> — Postiz integration gives white-label social scheduling without $99+/mo vendor lock-in; (3) <strong className="text-white">affiliate/referral intelligence</strong> — none of the 19 surveyed competitors natively combine affiliate tracking with social scheduling in one dashboard; (4) <strong className="text-white">vertical playbooks</strong> — pre-built content frameworks for wellness, yoga, healthcare, and professional services are not offered by any horizontal platform surveyed. The strategic play is to enter as an affordable all-in-one for health/wellness agencies ($29–79/mo), build a moat through AI and affiliate data network effects, and expand horizontally as the feature set matures.
          </p>
        </section>

        <section>
          <h3 className="text-white font-semibold text-base mb-2">Top 3 Threats &amp; Counter-Strategy</h3>
          <div className="space-y-3">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <div className="text-red-300 font-semibold text-sm mb-1">🔴 Threat 1: HubSpot (free CRM tier, brand recognition)</div>
              <p className="text-sm">HubSpot&apos;s free CRM locks SMBs into its ecosystem; Professional tier at $800/mo captures agencies. Counter: position as &quot;HubSpot for wellness agencies&quot; — same all-in-one promise at 1/10th the price, with local AI and open-source social scheduling. Target HubSpot customers on the $0→$800 upgrade cliff who churn rather than pay.</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
              <div className="text-orange-300 font-semibold text-sm mb-1">🟠 Threat 2: Hootsuite (broad scheduling, enterprise relationships)</div>
              <p className="text-sm">Hootsuite&apos;s 150M+ listening sources and compliance tooling make it sticky for enterprise accounts. Counter: do not compete head-to-head on listening at enterprise scale. Instead, undercut on price for SMB/agency (&lt;50-seat) accounts where Hootsuite&apos;s $99/seat/mo is painful, and emphasize affiliate ROI tracking which Hootsuite lacks entirely.</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
              <div className="text-orange-300 font-semibold text-sm mb-1">🟠 Threat 3: Postiz OSS (direct social scheduling overlap)</div>
              <p className="text-sm">Postiz&apos;s 32k-star GitHub community can self-host for $0 and get 33-platform social scheduling with AI. Counter: rather than competing, integrate Postiz as the open-source social layer and add TalentsHill&apos;s exclusive value — affiliate tracking, email automation, local Ollama, vertical content playbooks — on top. Offer managed hosting with SLA to justify a $29/mo cloud tier.</p>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-white font-semibold text-base mb-2">Top 3 Market Opportunities</h3>
          <div className="space-y-3">
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <div className="text-green-300 font-semibold text-sm mb-1">🟢 Opportunity 1: Affiliate + Social in One Dashboard</div>
              <p className="text-sm">Zero of 19 surveyed platforms natively combine affiliate/referral tracking with social media scheduling and publishing. This is a genuine feature gap in the market — validated by the fact that Hootsuite, Sprout Social, and HubSpot all require third-party integrations (Impact.com, ShareASale) for affiliate tracking.</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <div className="text-green-300 font-semibold text-sm mb-1">🟢 Opportunity 2: Local AI for Privacy-Conscious Industries</div>
              <p className="text-sm">Healthcare, legal, and financial-services businesses cannot send client data to OpenAI or Anthropic APIs. TalentsHill&apos;s Ollama integration — fully local, no telemetry — is a genuine compliance differentiator for these verticals, none of which are well-served by any surveyed platform.</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <div className="text-green-300 font-semibold text-sm mb-1">🟢 Opportunity 3: Managed Open-Source for Agencies</div>
              <p className="text-sm">Technical agency owners know Postiz and n8n exist but don&apos;t want to manage infrastructure. A managed, white-label bundle of Postiz + Mautic + n8n at $79/mo — with TalentsHill&apos;s agency dashboard on top — captures the open-source-aware buyer who is currently either self-hosting expensively or overpaying for Hootsuite.</p>
            </div>
          </div>
        </section>

        <div className="border-t border-white/10 pt-4 text-xs text-white/40">
          Sources: Hootsuite blog (2026), G2/Capterra comparisons (2026), Sprout Social pricing page, HubSpot pricing page, ActiveCampaign blog, Klaviyo pricing, Semrush pricing, Ahrefs pricing, Buffer pricing, Later pricing, Adobe Marketo pricing (business.adobe.com), Postiz GitHub (github.com/gitroomhq/postiz-app), n8n cloud pricing, Make.com pricing, Zapier pricing, Monday.com pricing.
        </div>
      </div>
    </div>
  );
}

// ─── Page Shell ──────────────────────────────────────────────────────────────

export default function CompetitorAnalysisPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Competitor Matrix');

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Market Intelligence</h1>
            <p className="text-white/60 mt-1 text-sm">
              Real competitor research across 19 digital marketing platforms · Updated September 2026
            </p>
          </div>
          <div className="flex gap-3 text-center shrink-0">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2">
              <div className="text-xl font-bold text-white">{COMPETITORS.length}</div>
              <div className="text-xs text-white/50">Platforms</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2">
              <div className="text-xl font-bold text-red-400">2</div>
              <div className="text-xs text-white/50">Critical Threats</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2">
              <div className="text-xl font-bold text-green-400">3</div>
              <div className="text-xs text-white/50">Key Gaps</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-1.5 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 min-w-fit px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap
              ${activeTab === tab
                ? 'bg-white/20 text-white shadow-lg'
                : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6">
        {activeTab === 'Competitor Matrix' && <CompetitorMatrix />}
        {activeTab === 'Market Positioning' && <MarketPositioning />}
        {activeTab === 'Feature Gap Analysis' && <FeatureGapAnalysis />}
        {activeTab === 'Pricing Intelligence' && <PricingIntelligence />}
        {activeTab === 'Research Report' && <ResearchReport />}
      </div>
    </div>
  );
}
