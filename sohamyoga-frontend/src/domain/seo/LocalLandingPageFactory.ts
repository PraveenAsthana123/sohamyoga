import { query } from '@/lib/postgres';

export interface LandingPageContent {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  locationName: string;
  serviceName: string;
}

/** Real local-landing-page content generator -- deterministic templating
 * over real location (branch) x real service (service_master) data. Not
 * an LLM call, not fabricated copy -- every field is built directly from
 * real fields (city, service name, description). Returns an empty array,
 * never placeholder pages, when either table has no real rows for this
 * tenant (both are 0 rows as of this session -- see Multi-Location
 * Management for the branch gap). */
export async function generateLocalLandingPages(tenantId: string, businessName: string): Promise<LandingPageContent[]> {
  const branches = await query<{ id: string; name: string; city: string; state: string }>(
    'SELECT id, name, city, state FROM branch WHERE tenant_id = $1 AND status = $2',
    [tenantId, 'active']
  );
  const services = await query<{ id: string; name: string; description: string | null }>(
    'SELECT id, name, description FROM service_master WHERE tenant_id = $1 AND status = $2',
    [tenantId, 'active']
  );

  const pages: LandingPageContent[] = [];
  for (const branch of branches.rows) {
    for (const service of services.rows) {
      const slug = `/${service.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${branch.city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      pages.push({
        slug,
        title: `${service.name} in ${branch.city}, ${branch.state} | ${businessName}`,
        metaDescription: `${service.name} at ${businessName} in ${branch.city}. ${service.description ?? ''}`.trim().slice(0, 160),
        h1: `${service.name} in ${branch.city}`,
        intro: `Looking for ${service.name.toLowerCase()} in ${branch.city}, ${branch.state}? ${businessName}'s ${branch.name} location offers this service to the local community.${service.description ? ` ${service.description}` : ''}`,
        locationName: branch.name,
        serviceName: service.name,
      });
    }
  }
  return pages;
}
