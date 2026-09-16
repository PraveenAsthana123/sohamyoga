interface TalentsHillPortalInfo {
  name: string;
  tagline: string;
  version: string;
  features: string[];
  services: string[];
  stats: {
    campaignsRun: string;
    clientRetention: string;
    averageRoas: string;
    teamExperts: string;
  };
}

export async function GET(): Promise<Response> {
  const info: TalentsHillPortalInfo = {
    name: 'TalentsHill',
    tagline: 'Full-service digital marketing that delivers measurable ROI',
    version: '1.0.0',
    features: [
      'Campaign Management',
      'Analytics & ROI Reporting',
      'Social Media Management',
      'Content Calendar',
      'Paid Ads Performance',
      'Lead & CRM Tracking',
      'Monthly PDF Reports',
      'Client Portal',
    ],
    services: [
      'SEO & Content',
      'Paid Advertising',
      'Social Media',
      'Email Marketing',
      'Analytics & BI',
      'Brand Strategy',
    ],
    stats: {
      campaignsRun: '500+',
      clientRetention: '98%',
      averageRoas: '3.2x',
      teamExperts: '50+',
    },
  };

  return Response.json(info);
}
