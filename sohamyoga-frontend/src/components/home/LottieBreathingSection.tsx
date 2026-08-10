'use client';

import { useState } from 'react';
import GlassCard from '@/components/ui/GlassCard';
import AnimeCounter from '@/components/ui/AnimeCounter';

const PHASES = [
  { label: 'Inhale',  seconds: 4,  color: 'from-green-500 to-emerald-600',  desc: 'Breathe in slowly through your nose' },
  { label: 'Hold',    seconds: 7,  color: 'from-teal-500 to-cyan-600',      desc: 'Hold gently — feel the fullness' },
  { label: 'Exhale',  seconds: 8,  color: 'from-indigo-500 to-purple-600',  desc: 'Release completely through your mouth' },
];

const STATS = [
  { label: 'Stress Reduced',     value: 68,  suffix: '%' },
  { label: 'Better Sleep',       value: 74,  suffix: '%' },
  { label: 'Focus Improved',     value: 81,  suffix: '%' },
  { label: 'Daily Practitioners',value: 1200, suffix: '+' },
];

const TECHNIQUES = [
  {
    name: '4-7-8 Breathing',
    tagline: 'Nervous system reset',
    desc: 'Inhale 4 · Hold 7 · Exhale 8. Activates the parasympathetic response within 2–3 cycles.',
    icon: '🌬️',
    color: 'from-green-800 to-emerald-950',
  },
  {
    name: 'Box Breathing',
    tagline: 'Navy SEAL technique',
    desc: 'Equal 4-count inhale, hold, exhale, hold. Builds focus and emotional regulation under pressure.',
    icon: '⬛',
    color: 'from-slate-800 to-gray-950',
  },
  {
    name: 'Nadi Shodhana',
    tagline: 'Alternate nostril',
    desc: 'Ancient pranayama that balances both hemispheres of the brain and calms racing thoughts instantly.',
    icon: '☯️',
    color: 'from-purple-800 to-violet-950',
  },
  {
    name: 'Kapalabhati',
    tagline: 'Skull-shining breath',
    desc: 'Rapid rhythmic exhales to energise, clear the respiratory tract, and ignite inner fire (tapas).',
    icon: '✨',
    color: 'from-amber-800 to-orange-950',
  },
];

export default function LottieBreathingSection() {
  const [activePhase, setActivePhase] = useState(0);
  const [breathing, setBreathing] = useState(false);

  const startBreathing = () => {
    setBreathing(true);
    let phase = 0;

    const runPhase = (p: number) => {
      setActivePhase(p);
      setTimeout(() => {
        if (p < PHASES.length - 1) runPhase(p + 1);
        else setBreathing(false);
      }, PHASES[p].seconds * 1000);
    };

    runPhase(phase);
  };

  const current = PHASES[activePhase];

  return (
    <section className="py-24 bg-yoga-dark overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">

        {/* Section header */}
        <div className="text-center mb-16">
          <span
            className="yoga-tag bg-green-400/10 text-green-400 border border-green-400/20 mb-4"
            data-aos="fade-down"
          >
            Breathwork & Meditation
          </span>
          <h2
            className="text-4xl md:text-5xl font-black text-white mb-4"
            data-aos="fade-up"
            data-aos-delay="50"
          >
            Breathe. Reset. Restore.
          </h2>
          <p
            className="text-white/60 text-lg max-w-2xl mx-auto"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            Science-backed pranayama practice reduces cortisol by up to 68% in 5 minutes.
            Every Soham class begins and ends with intentional breath.
          </p>
        </div>

        {/* Main breathing visualiser + techniques grid */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">

          {/* Breathing visualiser */}
          <div className="flex flex-col items-center gap-8" data-aos="fade-right">
            {/* Animated ring */}
            <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
              {/* Outer ring */}
              <div
                className={`absolute rounded-full border-2 border-white/10 breathing-ring`}
                style={{ width: 280, height: 280, animationDuration: `${(current.seconds * 2)}s` }}
              />
              {/* Middle ring */}
              <div
                className={`absolute rounded-full border border-white/20 breathing-ring`}
                style={{ width: 220, height: 220, animationDuration: `${(current.seconds * 2)}s`, animationDelay: '0.5s' }}
              />
              {/* Inner gradient circle */}
              <div
                className={`relative z-10 w-44 h-44 rounded-full bg-gradient-to-br ${current.color} flex flex-col items-center justify-center shadow-2xl breathing-ring`}
                style={{ animationDuration: `${current.seconds}s` }}
              >
                <span className="text-white font-black text-2xl">{current.label}</span>
                <span className="text-white/70 text-sm">{current.seconds}s</span>
              </div>
            </div>

            {/* Phase dots */}
            <div className="flex gap-3">
              {PHASES.map((p, i) => (
                <div
                  key={p.label}
                  className={`h-2 rounded-full transition-all duration-500 ${
                    i === activePhase ? 'w-10 bg-green-400' : 'w-2 bg-white/25'
                  }`}
                />
              ))}
            </div>

            {/* Instruction text */}
            <div className="text-center">
              <p className="text-white/80 text-base">{current.desc}</p>
            </div>

            {/* Start button */}
            <button
              onClick={startBreathing}
              disabled={breathing}
              className={`px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 ${
                breathing
                  ? 'glass text-white/50 cursor-not-allowed'
                  : 'bg-green-400 text-green-950 hover:bg-green-300 hover:-translate-y-1 shadow-lg hover:shadow-green-400/30'
              }`}
            >
              {breathing ? 'Breathing…' : 'Start 4-7-8 Cycle'}
            </button>
          </div>

          {/* Breathing techniques grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-aos="fade-left" data-aos-delay="100">
            {TECHNIQUES.map((tech) => (
              <div
                key={tech.name}
                className={`hover-lift rounded-2xl overflow-hidden bg-gradient-to-br ${tech.color} p-6`}
              >
                <div className="text-4xl mb-3">{tech.icon}</div>
                <span className="yoga-tag bg-white/10 text-white/70 mb-2">{tech.tagline}</span>
                <h3 className="text-white font-bold text-lg mb-2">{tech.name}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{tech.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-6"
          data-aos="fade-up"
          data-aos-delay="150"
        >
          {STATS.map((s) => (
            <GlassCard key={s.label} variant="dark" padding="p-6" className="text-center">
              <div className="text-4xl font-black text-green-400 mb-1">
                <AnimeCounter target={s.value} suffix={s.suffix} duration={2200} />
              </div>
              <div className="text-white/60 text-sm font-medium">{s.label}</div>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}
