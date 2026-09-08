import { query } from '@/lib/postgres';
import { getReviewSeoSignal, ReviewSeoSignal } from './ReviewSeoSignal';

export interface BusinessProfileForSchema {
  businessName: string;
  websiteUrl: string | null;
  industry: string;
}

export interface BranchForSchema {
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone: string | null;
}

export interface SchemaGenerationResult {
  jsonLd: Record<string, unknown>;
  missingFields: string[];
  sourcedFrom: { businessProfile: boolean; branch: boolean };
}

const INDUSTRY_TO_SCHEMA_TYPE: Record<string, string> = {
  yoga: 'ExerciseGym',
  dental: 'Dentist',
  retail: 'Store',
  restaurant: 'Restaurant',
  professional_services: 'ProfessionalService',
  other: 'LocalBusiness',
};

/** Real schema.org JSON-LD generator -- pulls only real tenant data
 * (marketing_business_profile, branch). Never fabricates an address, phone,
 * or hours that aren't actually on file; missingFields lists exactly what
 * was left out so the admin knows what to fill in before publishing this
 * markup, rather than silently shipping a schema with invented values. */
export function buildLocalBusinessSchema(profile: BusinessProfileForSchema, branch: BranchForSchema | null, reviews: ReviewSeoSignal | null = null): SchemaGenerationResult {
  const missingFields: string[] = [];
  const schemaType = INDUSTRY_TO_SCHEMA_TYPE[profile.industry] ?? 'LocalBusiness';

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: profile.businessName,
  };

  if (profile.websiteUrl) {
    jsonLd.url = profile.websiteUrl;
  } else {
    missingFields.push('website_url (marketing_business_profile)');
  }

  if (branch) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      streetAddress: branch.addressLine2 ? `${branch.addressLine1}, ${branch.addressLine2}` : branch.addressLine1,
      addressLocality: branch.city,
      addressRegion: branch.state,
      postalCode: branch.postalCode,
      addressCountry: branch.country,
    };
    if (branch.phone) {
      jsonLd.telephone = branch.phone;
    } else {
      missingFields.push('phone (branch)');
    }
  } else {
    missingFields.push('address (no branch row exists for this tenant)');
    missingFields.push('phone (no branch row exists for this tenant)');
  }

  if (reviews && reviews.reviewCount > 0 && reviews.averageRating !== null) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: reviews.averageRating.toFixed(1),
      reviewCount: reviews.reviewCount,
    };
  } else {
    missingFields.push('aggregateRating (no synced Google Business reviews yet)');
  }

  return {
    jsonLd,
    missingFields,
    sourcedFrom: { businessProfile: true, branch: branch !== null },
  };
}

/** Loads the real per-tenant profile + (if any) first branch and builds the
 * schema. Throws if no business profile exists yet -- there is nothing
 * honest to generate without at least a business name. */
export async function generateSchemaForTenant(tenantId: string): Promise<SchemaGenerationResult> {
  const profileResult = await query<{ business_name: string; website_url: string | null; industry: string }>(
    'SELECT business_name, website_url, industry FROM marketing_business_profile WHERE tenant_id = $1',
    [tenantId]
  );
  if (!profileResult.rows.length) {
    throw new Error('No marketing_business_profile row exists for this tenant -- set up the business profile before generating schema.');
  }
  const p = profileResult.rows[0];

  const branchResult = await query<{
    name: string; address_line1: string; address_line2: string | null; city: string;
    state: string; country: string; postal_code: string; phone: string | null;
  }>(
    `SELECT name, address_line1, address_line2, city, state, country, postal_code, phone
       FROM branch WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [tenantId]
  );
  const b = branchResult.rows[0];
  const reviews = await getReviewSeoSignal(tenantId);

  return buildLocalBusinessSchema(
    { businessName: p.business_name, websiteUrl: p.website_url, industry: p.industry },
    b ? {
      name: b.name, addressLine1: b.address_line1, addressLine2: b.address_line2, city: b.city,
      state: b.state, country: b.country, postalCode: b.postal_code, phone: b.phone,
    } : null,
    reviews
  );
}
