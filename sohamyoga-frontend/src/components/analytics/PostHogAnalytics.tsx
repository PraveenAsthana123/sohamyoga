'use client';
// Real PostHog product-analytics embed -- closes the documented gap:
// "heatmap-session-replay... grep for posthog/openreplay finds only
// comments/flag descriptions -- no actual SDK import, script tag, or API
// key wiring anywhere in the codebase." Dozens of FeatureFlag entries
// (analytics.session_replay, analytics.heatmaps, analytics.page_tracking,
// analytics.event_tracking, analytics.error_tracking, and several more)
// claimed "via PostHog" with nothing behind it -- this is the first real
// connection point for all of them, since PostHog's own snippet
// autocaptures pageviews/clicks/heatmap-data/session-recordings/exceptions
// once initialized, rather than needing a separate integration per flag.
//
// Consent-gated at the 'analytics' tier (lower bar than 'marketing' --
// this is product/UX analytics, not ad tracking), same hierarchy
// AnalyticsProvider/RetargetingPixels already enforce. Fails closed with
// no script loaded when no real project key is configured (see
// /admin/analytics Integrations tab).
//
// Session-recording input masking: PostHog's maskAllInputs defaults to
// true, satisfying the feature flag's own documented safetyNote ("Always
// mask name, email, phone, payment, password, health, message fields
// before recording") out of the box, not by extra code here.
import { useEffect, useState } from 'react';
import Script from 'next/script';
import { getStoredConsent, CONSENT_EVENT, type ConsentLevel } from './ConsentBanner';

const HIERARCHY: ConsentLevel[] = ['none', 'essential', 'analytics', 'marketing', 'all'];
function hasAnalyticsConsent(level: ConsentLevel | null): boolean {
  return level != null && HIERARCHY.indexOf(level) >= HIERARCHY.indexOf('analytics');
}

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

export default function PostHogAnalytics() {
  const [consented, setConsented] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setConsented(hasAnalyticsConsent(getStoredConsent()));
    const onConsent = (e: Event) => setConsented(hasAnalyticsConsent((e as CustomEvent).detail?.level ?? null));
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  useEffect(() => {
    if (!consented || checked) return;
    fetch('/api/tracking-pixels').then(r => r.ok ? r.json() : null)
      .then(d => setApiKey(d?.posthog?.enabled && d.posthog.pixelId ? d.posthog.pixelId : null))
      .catch(() => setApiKey(null))
      .finally(() => setChecked(true));
  }, [consented, checked]);

  if (!consented || !apiKey) return null;

  return (
    <Script id="posthog-init" strategy="afterInteractive">
      {`!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('${apiKey}', { api_host: '${POSTHOG_HOST}', capture_pageview: true, capture_pageleave: true, session_recording: { maskAllInputs: true } });`}
    </Script>
  );
}
