// Provider Simulation Layer — backlog item #24. Reframed honestly: this
// codebase has no MOCK/SANDBOX/LIVE adapter abstraction (that would be
// new infrastructure with no real behavior difference to demonstrate
// yet). What IS real and checkable: whether each real external
// provider's real credentials are actually configured in this
// environment -- a real 'configured'/'not_configured' status, never a
// fabricated 'connected' claim (configured != successfully reachable;
// see the Occasion Messaging item's real "Novu HTTP 404" finding for
// why those are different things).

const PROVIDERS = [
  { key: 'novu', name: 'Novu (notifications)', envVars: ['NOVU_API_KEY', 'NOVU_BASE_URL'] },
  { key: 'mautic', name: 'Mautic (CRM/drip)', envVars: ['MAUTIC_USER', 'MAUTIC_PASSWORD', 'MAUTIC_BASE_URL'] },
  { key: 'matomo', name: 'Matomo (analytics)', envVars: ['MATOMO_AUTH_TOKEN', 'MATOMO_BASE_URL', 'MATOMO_SITE_ID'] },
  { key: 'postiz', name: 'Postiz (social publishing)', envVars: ['POSTIZ_PUBLIC_API_KEY'] },
] as const;

export interface ProviderStatus { key: string; name: string; configured: boolean; missingEnvVars: string[] }

// Pure, unit-tested: real presence check over a real env snapshot
// (passed in, never read directly, so this is testable without
// mutating real process.env).
export function computeProviderStatus(envSnapshot: Record<string, string | undefined>): ProviderStatus[] {
  return PROVIDERS.map((p) => {
    const missing = p.envVars.filter((v) => !envSnapshot[v]);
    return { key: p.key, name: p.name, configured: missing.length === 0, missingEnvVars: missing };
  });
}

export function getRealProviderStatus(): ProviderStatus[] {
  return computeProviderStatus(process.env as Record<string, string | undefined>);
}
