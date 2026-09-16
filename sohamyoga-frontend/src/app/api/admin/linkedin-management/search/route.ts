import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const { rows } = await pool.query(
    'SELECT * FROM linkedin_search ORDER BY created_at DESC LIMIT 50'
  );
  return Response.json({ searches: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  try {
    const body = await req.json() as {
      search_name: string;
      search_type: string;
      keywords?: string;
      filters?: Record<string, string | number | boolean>;
    };

    if (!body.search_name || !body.search_type) {
      return Response.json({ error: 'search_name and search_type are required' }, { status: 400 });
    }

    // Generate demo results based on search type
    type DemoResult = {
      name: string;
      title: string;
      company: string;
      location: string;
      connection: string;
      industry?: string;
      size?: string;
      followers?: string;
      relevance?: string;
    };

    const demoResults: DemoResult[] = body.search_type === 'people'
      ? [
          { name: 'Sarah Chen', title: 'VP of People & Culture', company: 'TechCorp Inc', location: 'Toronto, ON', connection: '2nd' },
          { name: 'Michael Rodriguez', title: 'Chief HR Officer', company: 'Innovate Labs', location: 'Vancouver, BC', connection: '3rd' },
          { name: 'Priya Sharma', title: 'Wellness Program Manager', company: 'FinServ Group', location: 'Calgary, AB', connection: '2nd' },
          { name: 'James Wilson', title: 'Director of Employee Experience', company: 'RetailCo', location: 'Montreal, QC', connection: '3rd' },
          { name: 'Emma Thompson', title: 'Head of Corporate Wellness', company: 'InsureCorp', location: 'Ottawa, ON', connection: '2nd' },
        ]
      : body.search_type === 'company'
        ? [
            { name: 'TechCorp Inc', title: 'Technology', company: 'Toronto, ON', location: 'Toronto, ON', connection: '', industry: 'Software', size: '1001-5000', followers: '45K' },
            { name: 'Innovate Labs', title: 'R&D', company: 'Vancouver, BC', location: 'Vancouver, BC', connection: '', industry: 'Technology', size: '51-200', followers: '12K' },
            { name: 'FinServ Group', title: 'Financial Services', company: 'Calgary, AB', location: 'Calgary, AB', connection: '', industry: 'Finance', size: '5001+', followers: '89K' },
          ]
        : [
            { name: body.keywords ?? 'Sample Result 1', title: 'Relevant', company: 'Various', location: 'Canada', connection: '', relevance: 'High' },
            { name: 'Sample Result 2', title: 'Moderately Relevant', company: 'Various', location: 'USA', connection: '', relevance: 'Medium' },
          ];

    const { rows } = await pool.query(
      `INSERT INTO linkedin_search
         (search_name, search_type, keywords, filters, result_count, results, last_run_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       RETURNING *`,
      [
        body.search_name,
        body.search_type,
        body.keywords ?? '',
        JSON.stringify(body.filters ?? {}),
        demoResults.length,
        JSON.stringify(demoResults),
      ]
    );

    return Response.json({ search: rows[0] }, { status: 201 });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
