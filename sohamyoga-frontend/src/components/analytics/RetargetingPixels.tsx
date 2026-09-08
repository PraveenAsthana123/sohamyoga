'use client';
// Real Meta Pixel / GA4 embed -- the actual scripts ad platforms need to
// build a retargeting audience from site visitors. Before this component,
// grep for fbq(/gtag('config'/fbevents anywhere in this repo returned zero
// hits (module_registry: retargeting-pixels, not_built).
//
// Consent-gated using the SAME hierarchy AnalyticsProvider already
// enforces (none < essential < analytics < marketing < all) -- a
// retargeting/remarketing pixel is squarely a "marketing" concern, so it
// only ever loads once the visitor's stored consent reaches that level.
// Nothing fires pre-consent, and nothing fires for a platform with no real
// pixel ID configured (see /api/tracking-pixels -- returns pixelId:null
// unless an admin has actually saved one at /admin/ads Pixels tab).
import { useEffect, useState } from 'react';
import Script from 'next/script';
import { getStoredConsent, CONSENT_EVENT, type ConsentLevel } from './ConsentBanner';

const HIERARCHY: ConsentLevel[] = ['none', 'essential', 'analytics', 'marketing', 'all'];
function hasMarketingConsent(level: ConsentLevel | null): boolean {
  return level != null && HIERARCHY.indexOf(level) >= HIERARCHY.indexOf('marketing');
}

interface PixelState {
  metaPixel: { pixelId: string | null; enabled: boolean };
  ga4: { pixelId: string | null; enabled: boolean };
}

export default function RetargetingPixels() {
  const [consented, setConsented] = useState(false);
  const [pixels, setPixels] = useState<PixelState | null>(null);

  useEffect(() => {
    setConsented(hasMarketingConsent(getStoredConsent()));
    const onConsent = (e: Event) => setConsented(hasMarketingConsent((e as CustomEvent).detail?.level ?? null));
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  useEffect(() => {
    if (!consented || pixels) return;
    fetch('/api/tracking-pixels').then(r => r.ok ? r.json() : null).then(setPixels).catch(() => setPixels(null));
  }, [consented, pixels]);

  if (!consented || !pixels) return null;

  return (
    <>
      {pixels.metaPixel.enabled && pixels.metaPixel.pixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixels.metaPixel.pixelId}');
fbq('track', 'PageView');`}
        </Script>
      )}
      {pixels.ga4.enabled && pixels.ga4.pixelId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${pixels.ga4.pixelId}`} strategy="afterInteractive" />
          <Script id="ga4-config" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${pixels.ga4.pixelId}');`}
          </Script>
        </>
      )}
    </>
  );
}
