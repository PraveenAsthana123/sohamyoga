import { Metadata } from 'next';
import Link from 'next/link';
import type { TeamMember } from '@/lib/api';
import { SERVER_API_URL as API_URL } from '@/lib/server-api';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about SohamYoga - a Calgary-based technology company delivering cutting-edge IT solutions, AI/ML services, and digital transformation strategies.',
  openGraph: {
    title: 'About Us - SohamYoga',
    description: 'Learn about SohamYoga - delivering cutting-edge IT solutions and AI services.',
  },
};

async function getTeamMembers(): Promise<TeamMember[]> {
  try {
    const res = await fetch(`${API_URL}/api/team`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function AboutPage() {
  const teamMembers = await getTeamMembers();
  const activeMembers = teamMembers.filter((m) => m.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      {/* Hero Section */}
      <section className="gradient-bg pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-20 w-72 h-72 bg-accent-400 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 bg-white/20 text-white text-sm font-semibold rounded-full mb-4">
              About SohamYoga
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Empowering Businesses Through{' '}
              <span className="text-accent-400">Innovation</span>
            </h1>
            <p className="text-lg text-primary-200 leading-relaxed">
              Based in Calgary, Alberta, SohamYoga is a forward-thinking technology company
              dedicated to helping businesses harness the power of artificial intelligence,
              machine learning, and modern IT solutions.
            </p>
          </div>
        </div>
      </section>

      {/* Company Overview */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-dark-900 mb-6">
                Who We Are
              </h2>
              <div className="space-y-4 text-dark-600 leading-relaxed">
                <p>
                  SohamYoga is a technology consulting and solutions company specializing
                  in artificial intelligence, machine learning, deep learning, and comprehensive
                  IT management services. We partner with businesses of all sizes to deliver
                  tailored solutions that drive growth, efficiency, and competitive advantage.
                </p>
                <p>
                  Our team combines deep technical expertise with a thorough understanding
                  of business challenges. We do not just implement technology -- we craft
                  strategic solutions that align with your goals and deliver measurable results.
                </p>
                <p>
                  From startups looking to integrate AI into their products to enterprises
                  seeking digital transformation, we bring the right blend of innovation
                  and pragmatism to every engagement.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-primary-50 rounded-xl p-6 text-center">
                <p className="text-4xl font-bold text-primary-600 mb-2">AI</p>
                <p className="text-sm text-dark-600 font-medium">Artificial Intelligence</p>
              </div>
              <div className="bg-accent-50 rounded-xl p-6 text-center">
                <p className="text-4xl font-bold text-accent-600 mb-2">ML</p>
                <p className="text-sm text-dark-600 font-medium">Machine Learning</p>
              </div>
              <div className="bg-accent-50 rounded-xl p-6 text-center">
                <p className="text-4xl font-bold text-accent-600 mb-2">DL</p>
                <p className="text-sm text-dark-600 font-medium">Deep Learning</p>
              </div>
              <div className="bg-primary-50 rounded-xl p-6 text-center">
                <p className="text-4xl font-bold text-primary-600 mb-2">IT</p>
                <p className="text-sm text-dark-600 font-medium">Managed Services</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission, Vision, Values */}
      <section className="py-16 bg-dark-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="section-title text-dark-900">Our Foundation</h2>
          <p className="section-subtitle">
            The principles that guide everything we do at SohamYoga.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Mission */}
            <div className="bg-white rounded-xl p-8 shadow-md border border-dark-100 hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-dark-900 mb-3">Our Mission</h3>
              <p className="text-dark-500 leading-relaxed">
                To empower businesses with cutting-edge technology solutions that transform
                operations, unlock new opportunities, and create lasting competitive advantages
                in an increasingly digital world.
              </p>
            </div>

            {/* Vision */}
            <div className="bg-white rounded-xl p-8 shadow-md border border-dark-100 hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-accent-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-dark-900 mb-3">Our Vision</h3>
              <p className="text-dark-500 leading-relaxed">
                To be the most trusted technology partner for businesses in Western Canada
                and beyond, recognized for our expertise in AI/ML, our commitment to
                client success, and our ability to deliver transformative results.
              </p>
            </div>

            {/* Values */}
            <div className="bg-white rounded-xl p-8 shadow-md border border-dark-100 hover:shadow-xl transition-shadow">
              <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-dark-900 mb-3">Our Values</h3>
              <ul className="text-dark-500 space-y-2">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-accent-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Innovation in everything we do</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-accent-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Integrity and transparency</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-accent-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Client-first mentality</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-accent-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Excellence in delivery</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-accent-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Continuous learning</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose SohamYoga */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="section-title text-dark-900">Why Choose SohamYoga?</h2>
          <p className="section-subtitle">
            We combine technical depth with business acumen to deliver solutions that matter.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: (
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                ),
                title: 'AI & ML Expertise',
                desc: 'Deep expertise in the latest AI/ML technologies including generative AI, computer vision, and deep learning.',
              },
              {
                icon: (
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                ),
                title: 'Dedicated Team',
                desc: 'Experienced professionals committed to understanding your unique challenges and delivering tailored solutions.',
              },
              {
                icon: (
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                title: 'Proven Track Record',
                desc: 'Successfully delivered solutions across multiple industries including finance, healthcare, energy, and retail.',
              },
              {
                icon: (
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                ),
                title: 'Results-Driven',
                desc: 'We measure success by the business outcomes we deliver, not just the technology we deploy.',
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="group bg-dark-50 rounded-xl p-6 hover:bg-white hover:shadow-xl transition-all duration-300 border border-dark-100"
              >
                <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center mb-4 text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold text-dark-900 mb-2">{item.title}</h3>
                <p className="text-sm text-dark-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      {activeMembers.length > 0 && (
        <section className="py-16 bg-dark-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="section-title text-dark-900">Meet Our Team</h2>
            <p className="section-subtitle">
              The talented people behind SohamYoga who make innovation happen every day.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {activeMembers.map((member) => (
                <div
                  key={member.id}
                  className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-dark-100 group"
                >
                  {/* Avatar */}
                  <div className="h-48 bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center relative overflow-hidden">
                    {member.imageUrl ? (
                      <img
                        src={member.imageUrl}
                        alt={member.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <span className="text-5xl font-bold text-white/80">
                        {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </span>
                    )}
                  </div>

                  <div className="p-5 text-center">
                    <h3 className="font-bold text-dark-900 text-lg">{member.name}</h3>
                    <p className="text-primary-600 text-sm font-medium mb-3">{member.title}</p>
                    {member.bio && (
                      <p className="text-dark-500 text-sm leading-relaxed line-clamp-3">
                        {member.bio}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-dark-900 via-primary-900 to-dark-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-1/4 w-64 h-64 bg-accent-400 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-72 h-72 bg-primary-400 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Start Your Journey?
          </h2>
          <p className="text-dark-300 text-lg mb-8 max-w-2xl mx-auto">
            Whether you are exploring AI for the first time or looking to scale existing solutions,
            our team is here to help you succeed.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/contact" className="btn-accent">
              Contact Us Today
            </Link>
            <Link href="/services/generative-ai" className="inline-flex items-center justify-center px-6 py-3 border-2 border-dark-600 text-white font-semibold rounded-lg hover:bg-dark-800 transition-all duration-300">
              Explore Our Services
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
