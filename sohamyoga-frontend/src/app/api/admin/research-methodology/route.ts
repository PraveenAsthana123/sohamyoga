export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

const SEED_METHODOLOGIES = [
  { name: 'Surveys', category: 'Quantitative', description: 'Structured questionnaires to collect data from a large sample of respondents.', steps: ['Define research objectives', 'Design questionnaire', 'Select sample', 'Distribute survey', 'Collect responses', 'Analyze data', 'Report findings'], tools: ['SurveyMonkey', 'Google Forms', 'Typeform', 'SPSS'], use_cases: ['Customer satisfaction', 'Market sizing', 'Brand awareness'], estimated_days: 14, cost_level: 'low' },
  { name: 'Focus Groups', category: 'Qualitative', description: 'Moderated group discussions to explore attitudes, perceptions, and opinions in depth.', steps: ['Define objectives', 'Recruit participants', 'Design discussion guide', 'Conduct sessions', 'Analyze transcripts', 'Synthesize insights'], tools: ['Zoom', 'Lookback', 'UserZoom'], use_cases: ['Product concept testing', 'Message testing', 'Brand perception'], estimated_days: 21, cost_level: 'medium' },
  { name: 'A/B Testing', category: 'Quantitative', description: 'Controlled experiments comparing two variants to determine which performs better.', steps: ['Define hypothesis', 'Identify metric', 'Design variants', 'Calculate sample size', 'Run experiment', 'Analyze results', 'Implement winner'], tools: ['Optimizely', 'VWO', 'Google Optimize', 'LaunchDarkly'], use_cases: ['Landing page optimization', 'Email subject lines', 'Pricing tests'], estimated_days: 28, cost_level: 'low' },
  { name: 'Ethnography', category: 'Qualitative', description: 'Observational study of people in their natural environment to understand behavior in context.', steps: ['Define scope', 'Gain access', 'Observe and document', 'Conduct contextual interviews', 'Analyze field notes', 'Extract insights'], tools: ['Field notes', 'Video recording', 'NVivo'], use_cases: ['User experience research', 'Cultural insights', 'Product design'], estimated_days: 45, cost_level: 'high' },
  { name: 'Case Studies', category: 'Mixed', description: 'In-depth investigation of a specific instance or event to understand complex phenomena.', steps: ['Select case', 'Define research questions', 'Collect data', 'Analyze evidence', 'Write narrative', 'Draw conclusions'], tools: ['NVivo', 'Atlas.ti', 'Excel'], use_cases: ['Best practice analysis', 'Failure analysis', 'Process improvement'], estimated_days: 30, cost_level: 'medium' },
  { name: 'Secondary Research', category: 'Quantitative', description: 'Analysis of existing data, reports, and studies to answer research questions.', steps: ['Define information needs', 'Identify sources', 'Collect data', 'Evaluate quality', 'Synthesize findings', 'Document sources'], tools: ['Statista', 'IBISWorld', 'Euromonitor', 'Google Scholar'], use_cases: ['Market sizing', 'Competitive landscape', 'Trend analysis'], estimated_days: 7, cost_level: 'low' },
  { name: 'Competitive Analysis', category: 'Strategic', description: 'Systematic evaluation of competitor strengths, weaknesses, strategies, and market position.', steps: ['Identify competitors', 'Define dimensions', 'Collect data', 'Analyze gaps', 'Map positioning', 'Develop strategy'], tools: ['SEMrush', 'SimilarWeb', 'SpyFu', 'Crayon'], use_cases: ['Market entry', 'Pricing strategy', 'Product differentiation'], estimated_days: 10, cost_level: 'low' },
  { name: 'SWOT Analysis', category: 'Strategic', description: 'Framework for evaluating Strengths, Weaknesses, Opportunities, and Threats.', steps: ['Gather stakeholder input', 'List internal factors', 'List external factors', 'Map to quadrants', 'Prioritize', 'Develop action items'], tools: ['Miro', 'Lucidchart', 'PowerPoint'], use_cases: ['Strategic planning', 'Business review', 'Product launch'], estimated_days: 5, cost_level: 'low' },
  { name: "Porter's Five Forces", category: 'Strategic', description: 'Framework for analyzing competitive forces shaping an industry.', steps: ['Identify industry', 'Assess buyer power', 'Assess supplier power', 'Assess substitutes', 'Assess new entrants', 'Assess rivalry', 'Synthesize'], tools: ['Excel', 'PowerPoint', 'Industry reports'], use_cases: ['Industry attractiveness', 'Market entry', 'Strategic planning'], estimated_days: 7, cost_level: 'low' },
  { name: 'PESTEL Analysis', category: 'Strategic', description: 'Macro-environmental analysis covering Political, Economic, Social, Technological, Environmental, and Legal factors.', steps: ['Define scope', 'Research each factor', 'Assess impact', 'Prioritize factors', 'Map to strategy', 'Monitor changes'], tools: ['Excel', 'Strategy tools', 'News databases'], use_cases: ['Market entry', 'Risk assessment', 'Strategic planning'], estimated_days: 5, cost_level: 'low' },
  { name: 'Conjoint Analysis', category: 'Quantitative', description: 'Statistical technique to determine how consumers value different product attributes.', steps: ['Define attributes', 'Design survey', 'Collect responses', 'Run statistical model', 'Calculate utilities', 'Simulate scenarios'], tools: ['Sawtooth Software', 'Qualtrics', 'R', 'SPSS'], use_cases: ['Pricing research', 'Product configuration', 'Feature prioritization'], estimated_days: 30, cost_level: 'high' },
  { name: 'Delphi Method', category: 'Mixed', description: 'Structured expert elicitation through iterative rounds of questionnaires to reach consensus.', steps: ['Select experts', 'Round 1 questionnaire', 'Summarize responses', 'Share summary', 'Round 2 questionnaire', 'Iterate', 'Finalize consensus'], tools: ['Email', 'Survey tools', 'Excel'], use_cases: ['Forecasting', 'Policy research', 'Technology roadmaps'], estimated_days: 45, cost_level: 'medium' },
  { name: 'Grounded Theory', category: 'Qualitative', description: 'Systematic inductive methodology to develop theory from collected data.', steps: ['Open sampling', 'Open coding', 'Axial coding', 'Selective coding', 'Theoretical sampling', 'Saturation', 'Theory development'], tools: ['NVivo', 'Atlas.ti', 'MAXQDA'], use_cases: ['New market understanding', 'Customer behavior', 'Organizational research'], estimated_days: 90, cost_level: 'high' },
  { name: 'Longitudinal Study', category: 'Quantitative', description: 'Repeated observation of the same variables over an extended period to track change.', steps: ['Define cohort', 'Baseline measurement', 'Periodic data collection', 'Track attrition', 'Analyze trends', 'Report findings'], tools: ['SPSS', 'R', 'Stata', 'REDCap'], use_cases: ['Brand tracking', 'Customer lifetime value', 'Behavior change'], estimated_days: 180, cost_level: 'high' },
  { name: 'Cross-sectional Study', category: 'Quantitative', description: 'Analysis of data collected from a population at a single point in time.', steps: ['Define population', 'Sample selection', 'Data collection', 'Statistical analysis', 'Control for confounders', 'Report'], tools: ['SPSS', 'R', 'Google Forms'], use_cases: ['Prevalence studies', 'Market snapshots', 'Attitude surveys'], estimated_days: 21, cost_level: 'medium' },
  { name: 'Meta-Analysis', category: 'Quantitative', description: 'Statistical synthesis of results from multiple independent studies on the same topic.', steps: ['Define search criteria', 'Systematic literature search', 'Screening', 'Data extraction', 'Heterogeneity assessment', 'Pooled analysis', 'Report'], tools: ['RevMan', 'R (meta package)', 'Stata'], use_cases: ['Evidence synthesis', 'Clinical research', 'Marketing effectiveness'], estimated_days: 60, cost_level: 'medium' },
  { name: 'Benchmarking', category: 'Strategic', description: 'Comparing performance metrics to industry best practices or top competitors.', steps: ['Select metrics', 'Identify benchmarks', 'Collect data', 'Analyze gaps', 'Set targets', 'Implement improvements', 'Monitor'], tools: ['Excel', 'Tableau', 'Industry databases'], use_cases: ['Performance improvement', 'KPI setting', 'Best practice adoption'], estimated_days: 14, cost_level: 'low' },
  { name: 'Mystery Shopping', category: 'Qualitative', description: 'Trained evaluators pose as customers to assess service quality and compliance.', steps: ['Define evaluation criteria', 'Recruit shoppers', 'Train shoppers', 'Conduct visits', 'Complete scorecards', 'Analyze results', 'Report'], tools: ['Sassie', 'iSecretShop', 'Custom forms'], use_cases: ['Customer experience', 'Service compliance', 'Competitive benchmarking'], estimated_days: 14, cost_level: 'medium' },
  { name: 'Net Promoter Score', category: 'Quantitative', description: 'Simple loyalty metric measuring willingness to recommend on a 0-10 scale.', steps: ['Deploy survey', 'Collect responses', 'Segment into promoters/passives/detractors', 'Calculate NPS', 'Follow-up interviews', 'Act on feedback'], tools: ['Delighted', 'SurveyMonkey', 'Medallia', 'Qualtrics'], use_cases: ['Customer loyalty', 'Product satisfaction', 'Employee satisfaction'], estimated_days: 7, cost_level: 'low' },
  { name: 'Jobs-to-be-Done', category: 'Qualitative', description: "Framework for understanding the underlying 'job' customers hire a product to do.", steps: ['Recruit participants', 'Conduct switch interviews', 'Map the timeline of events', 'Identify struggling moments', 'Define job statements', 'Prioritize opportunities'], tools: ['Interview transcripts', 'Miro', 'Affinity mapping'], use_cases: ['Product innovation', 'Marketing messaging', 'Churn analysis'], estimated_days: 21, cost_level: 'medium' },
];

async function ensureTableAndSeed(client: import('pg').PoolClient): Promise<void> {
  await client.query(`CREATE TABLE IF NOT EXISTS research_methodology (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    steps TEXT[],
    tools TEXT[],
    use_cases TEXT[],
    estimated_days INT,
    cost_level TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  const { rows } = await client.query('SELECT COUNT(*) AS n FROM research_methodology');
  if (parseInt(rows[0].n, 10) === 0) {
    for (const m of SEED_METHODOLOGIES) {
      await client.query(
        `INSERT INTO research_methodology (name, category, description, steps, tools, use_cases, estimated_days, cost_level)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [m.name, m.category, m.description, m.steps, m.tools, m.use_cases, m.estimated_days, m.cost_level]
      );
    }
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTableAndSeed(client);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (category && category !== 'All') { params.push(category); conditions.push(`category=$${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`); }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const r = await client.query(`SELECT * FROM research_methodology${where} ORDER BY name ASC`, params);
    return Response.json({ items: r.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const { name, category, description, steps, tools, use_cases, estimated_days, cost_level } = body;
  if (!name || !category) return Response.json({ error: 'name and category required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTableAndSeed(client);
    const r = await client.query(
      `INSERT INTO research_methodology (name, category, description, steps, tools, use_cases, estimated_days, cost_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, category, description, steps || [], tools || [], use_cases || [], estimated_days || null, cost_level || 'medium']
    );
    return Response.json(r.rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
