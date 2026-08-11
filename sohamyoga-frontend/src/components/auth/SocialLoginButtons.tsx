'use client';

interface SocialLoginButtonsProps {
  redirectTo?: string;
}

const PROVIDERS = [
  { id: 'google',    label: 'Google',    icon: '🔵', bg: 'bg-white text-gray-800 hover:bg-gray-50',       hint: 'Most popular' },
  // Meta's official #1877F2 only gives 4.23:1 contrast with white text
  // (needs 4.5:1) — using their own slightly-darker brand variant instead.
  { id: 'facebook',  label: 'Facebook',  icon: '📘', bg: 'bg-[#166FE5] text-white hover:bg-[#1465CE]',   hint: '' },
  { id: 'apple',     label: 'Apple',     icon: '🍎', bg: 'bg-black text-white hover:bg-gray-900',         hint: 'Private email' },
  { id: 'microsoft', label: 'Microsoft', icon: '🪟', bg: 'bg-[#2F2F2F] text-white hover:bg-[#1f1f1f]',  hint: '' },
];

export default function SocialLoginButtons({ redirectTo = '/student/dashboard' }: SocialLoginButtonsProps) {
  const handleSocial = (provider: string) => {
    // Redirect to Keycloak's social identity broker endpoint.
    // The `kc_idp_hint` param skips the Keycloak login page entirely.
    // TODO: replace KEYCLOAK_URL and REALM with env vars
    const keycloakBase = process.env.NEXT_PUBLIC_KEYCLOAK_URL ?? '/auth';
    const realm        = process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? 'sohamyoga';
    const clientId     = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'yoga-portal';
    const redirect     = encodeURIComponent(`${window.location.origin}${redirectTo}`);

    const url =
      `${keycloakBase}/realms/${realm}/protocol/openid-connect/auth` +
      `?client_id=${clientId}` +
      `&redirect_uri=${redirect}` +
      `&response_type=code` +
      `&scope=openid+email+profile` +
      `&kc_idp_hint=${provider}`;

    window.location.href = url;
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => handleSocial(p.id)}
          className={`relative flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                      font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5
                      shadow-md hover:shadow-lg ${p.bg}`}
        >
          <span>{p.icon}</span>
          <span>{p.label}</span>
          {p.hint && (
            <span className="absolute -top-1.5 -right-1 text-[9px] bg-green-400 text-green-950
                             font-bold px-1.5 py-0.5 rounded-full">
              {p.hint}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
