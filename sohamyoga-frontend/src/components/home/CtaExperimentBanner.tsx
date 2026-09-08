'use client';
// Real landing-page A/B test — the Experiments framework (src/domain/
// experimentation, /api/experiments) existed and worked but had zero
// visitor-facing pages calling it (confirmed via a full-repo grep before
// building this). This wires it to a real, additive homepage CTA banner
// without touching the existing hero carousel's internals.

import Link from 'next/link';
import { useEffect, useState } from 'react';

const EXPERIMENT_KEY = 'homepage-final-cta';
const DEFAULT_TEXT = 'Browse Classes';

function anonymousId(): string {
  const stored = localStorage.getItem('sohamyoga_anon_id');
  if (stored) return stored;
  const id = `anon-${Math.random().toString(36).slice(2, 10)}-${performance.now().toString(36).replace('.', '')}`;
  localStorage.setItem('sohamyoga_anon_id', id);
  return id;
}

export default function CtaExperimentBanner() {
  const [ctaText, setCtaText] = useState(DEFAULT_TEXT);

  useEffect(() => {
    fetch(`/api/experiments/${EXPERIMENT_KEY}/assign?subjectId=${encodeURIComponent(anonymousId())}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.assigned && data.variant?.name) setCtaText(data.variant.name); })
      .catch(() => { /* keep the default control text on any failure */ });
  }, []);

  return (
    <section className="bg-emerald-700 py-12 text-center text-white">
      <h2 className="text-2xl font-bold">Ready to start your practice?</h2>
      <p className="mt-2 text-emerald-100">Join our community today.</p>
      <Link href="/services" className="mt-6 inline-block rounded-lg bg-white px-8 py-3 font-semibold text-emerald-700 transition-colors hover:bg-emerald-50">
        {ctaText}
      </Link>
    </section>
  );
}
