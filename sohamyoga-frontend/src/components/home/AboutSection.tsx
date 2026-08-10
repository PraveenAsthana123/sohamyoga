import Link from 'next/link';

const stats = [
  { value: '🧘', label: 'All Skill Levels' },
  { value: '🌱', label: 'Beginner Friendly' },
  { value: '🤝', label: 'Welcoming Community' },
  { value: '📍', label: 'Calgary, Alberta' },
];

const highlights = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'Mindful Practice',
    description: 'Every class is designed to build strength, flexibility, and calm, at a pace that suits you.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Safe & Supportive',
    description: 'Instructors are attentive to alignment and safety so you can practice with confidence.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Dedicated Instructors',
    description: 'Certified teachers who bring experience and genuine care to every class.',
  },
];

export default function AboutSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left side - Content */}
          <div>
            <span className="inline-block text-primary-600 text-sm font-semibold tracking-wider uppercase mb-4">
              About SohamYoga
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-dark-900 mb-6 leading-tight">
              Your Home for{' '}
              <span className="text-primary-600">Mindful Practice</span>
            </h2>
            <p className="text-dark-500 text-lg leading-relaxed mb-6">
              Based in Calgary, Alberta, SohamYoga is a yoga studio offering classes for every
              level. We help our students build strength, flexibility, and mindfulness through
              consistent, supported practice.
            </p>
            <p className="text-dark-500 leading-relaxed mb-8">
              From your first class to an established practice, our instructors are here to
              guide you — plus a studio shop stocked with mats, props, and accessories.
            </p>

            {/* Highlights */}
            <div className="space-y-5 mb-8">
              {highlights.map((item, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-dark-900 mb-1">{item.title}</h3>
                    <p className="text-dark-500 text-sm leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link href="/about" className="btn-primary">
              Learn More About Us
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          {/* Right side - Stats and visual */}
          <div className="relative">
            {/* Decorative gradient card */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-dark-900 p-8 lg:p-10">
              {/* Background decorations */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent-400 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-300 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
              </div>

              <div className="relative z-10">
                <div className="grid grid-cols-2 gap-6">
                  {stats.map((stat, index) => (
                    <div
                      key={index}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10 text-center"
                    >
                      <div className="text-3xl lg:text-4xl font-bold text-white mb-1">
                        {stat.value}
                      </div>
                      <div className="text-white/70 text-sm font-medium">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom section */}
                <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-accent-500 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-white font-semibold">Community First</div>
                      <div className="text-white/70 text-sm">
                        A studio where every student is welcome
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
