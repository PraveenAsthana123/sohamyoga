// Business Readiness Score -- a real, deterministic completeness rubric for
// a new tenant's setup, using the shared HealthModel (same 80/50
// traffic-light convention as BrandHealthScore/ResearchHealthScore). Every
// point is traceable to a real row/field existing -- no AI opinion, no
// fabricated score.
import { combineWeightedScore, trafficLightFor, type TrafficLight } from '@/domain/shared/HealthModel';

export interface ReadinessCheck {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface ReadinessResult {
  score: number;
  trafficLight: TrafficLight;
  checks: ReadinessCheck[];
}

export interface TenantReadinessInputs {
  hasBusinessProfile: boolean;
  hasBrandKit: boolean;
  branchCount: number;
  productCount: number;
  connectedChannelCount: number;
  hasOwner: boolean;
}

export function computeBusinessReadiness(inputs: TenantReadinessInputs): ReadinessResult {
  const checks: ReadinessCheck[] = [
    {
      id: 'business_profile', label: 'Business Profile', status: inputs.hasBusinessProfile ? 'pass' : 'fail',
      detail: inputs.hasBusinessProfile ? 'Industry and business details are set.' : 'No business profile yet -- set industry and business name.',
    },
    {
      id: 'brand_kit', label: 'Brand Kit', status: inputs.hasBrandKit ? 'pass' : 'warn',
      detail: inputs.hasBrandKit ? 'A default brand kit exists.' : 'No brand kit yet -- colors/fonts/tone are undefined.',
    },
    {
      id: 'branch', label: 'Locations', status: inputs.branchCount > 0 ? 'pass' : 'fail',
      detail: inputs.branchCount > 0 ? `${inputs.branchCount} branch(es) configured.` : 'No branch/location configured yet.',
    },
    {
      id: 'catalog', label: 'Products / Services', status: inputs.productCount > 0 ? 'pass' : 'warn',
      detail: inputs.productCount > 0 ? `${inputs.productCount} product(s)/service(s) in the catalog.` : 'No products or services added yet.',
    },
    {
      id: 'channels', label: 'Connected Channels', status: inputs.connectedChannelCount > 0 ? 'pass' : 'warn',
      detail: inputs.connectedChannelCount > 0 ? `${inputs.connectedChannelCount} channel(s) enabled.` : 'No marketing channels connected yet.',
    },
    {
      id: 'owner', label: 'Account Owner', status: inputs.hasOwner ? 'pass' : 'fail',
      detail: inputs.hasOwner ? 'An owner user is assigned.' : 'No owner user assigned to this tenant.',
    },
  ];

  const statusScore = (s: ReadinessCheck['status']) => s === 'pass' ? 100 : s === 'warn' ? 50 : 0;
  const score = combineWeightedScore(checks.map(c => ({ score: statusScore(c.status), weight: 1 })));

  return { score, trafficLight: trafficLightFor(score), checks };
}
