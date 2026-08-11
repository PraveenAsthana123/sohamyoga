import type { Metadata } from 'next';
import Link from 'next/link';
import type { HomePageData, Service, Testimonial, TeamMember } from '@/lib/api';
import SwiperHero, { type HeroSlide } from '@/components/carousel/SwiperHero';
import InfiniteMarquee, { type MarqueeItem } from '@/components/carousel/InfiniteMarquee';
import TestimonialCarousel, { type TestimonialSlide } from '@/components/carousel/TestimonialCarousel';
import TeacherCarousel, { type TeacherSlide } from '@/components/carousel/TeacherCarousel';
import AboutSection from '@/components/home/AboutSection';
import CaseStudiesSection from '@/components/home/CaseStudiesSection';
import IndustriesSection from '@/components/home/IndustriesSection';
import VideoDemoSection from '@/components/home/VideoDemoSection';
import BlogSection from '@/components/home/BlogSection';
import NewsletterSection from '@/components/home/NewsletterSection';
import { SERVER_API_URL as API_URL } from '@/lib/server-api';

export const metadata: Metadata = {
  title: 'Soham Yoga Studio - Classes, Teachers & Wellness Programs',
  description:
    'Soham Yoga is a yoga studio offering Hatha, Vinyasa, Ashtanga, Yin, and more, taught by certified instructors. Book a class, meet the team, or start with a free first class.',
  keywords: [
    'Yoga Studio',
    'Yoga Classes',
    'Hatha Yoga',
    'Vinyasa Yoga',
    'Ashtanga Yoga',
    'Yin Yoga',
    'Yoga Teacher Training',
    'Yoga Membership',
    'Beginner Yoga Classes',
    'Wellness Studio',
  ],
  openGraph: {
    title: 'Soham Yoga Studio - Classes, Teachers & Wellness Programs',
    description:
      'Book a real yoga class, meet our certified teachers, and find the right program for your practice.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Soham Yoga',
  },
};

// ── Static hero slides (gradient-type: no image assets required) ──────────────

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'hero-1',
    type: 'gradient',
    gradientClass: 'bg-gradient-to-br from-accent-700 via-accent-600 to-primary-600',
    heading: 'Find Your Inner Balance',
    subheading: 'Soham Yoga Studio',
    description:
      'Join our community of mindful practitioners and discover the transformative power of yoga.',
    ctaText: 'Browse Classes',
    ctaUrl: '/services',
    secondaryCtaText: 'Our Story',
    secondaryCtaUrl: '/about',
  },
  {
    id: 'hero-2',
    type: 'gradient',
    gradientClass: 'bg-gradient-to-br from-accent-600 via-accent-500 to-primary-500',
    heading: 'Elevate Your Practice',
    subheading: 'Expert Teachers',
    description:
      'Learn from certified instructors with decades of experience across Hatha, Vinyasa, and Yin traditions.',
    ctaText: 'Meet Our Teachers',
    ctaUrl: '/about',
    secondaryCtaText: 'Class Schedule',
    secondaryCtaUrl: '/services',
  },
  {
    id: 'hero-3',
    type: 'gradient',
    gradientClass: 'bg-gradient-to-br from-primary-600 via-primary-500 to-accent-600',
    heading: 'Mind, Body & Soul',
    subheading: 'Complete Wellness',
    description:
      'From beginner flows to advanced Ashtanga — we have a program for every stage of your journey.',
    ctaText: 'Explore Programs',
    ctaUrl: '/services',
    secondaryCtaText: 'Read Our Blog',
    secondaryCtaUrl: '/blog',
  },
  {
    id: 'hero-4',
    type: 'gradient',
    gradientClass: 'bg-gradient-to-br from-accent-500 via-primary-400 to-primary-500',
    heading: 'Begin Your Journey Today',
    subheading: 'First Class Free',
    description:
      'New to yoga? Start with our beginner-friendly welcome program and experience the Soham difference.',
    ctaText: 'Get Started',
    ctaUrl: '/contact',
    secondaryCtaText: 'Contact Us',
    secondaryCtaUrl: '/contact',
  },
];

// ── Data adapters ─────────────────────────────────────────────────────────────

function toMarqueeItems(services: Service[]): MarqueeItem[] {
  return services.map(s => ({
    id: String(s.id),
    label: s.title,
    description: s.shortDescription,
    href: `/services/${s.slug}`,
  }));
}

function toTestimonialSlides(testimonials: Testimonial[]): TestimonialSlide[] {
  return testimonials.map(t => ({
    id: String(t.id),
    authorName: t.authorName,
    authorTitle: t.authorTitle,
    company: t.company,
    quote: t.quote,
    rating: t.rating,
    initials: t.initials,
  }));
}

function toTeacherSlides(members: TeamMember[]): TeacherSlide[] {
  return members.map(m => ({
    id: String(m.id),
    name: m.name,
    role: m.title,
    bio: m.bio,
    photoSrc: m.imageUrl,
  }));
}

// ── Data fetch ────────────────────────────────────────────────────────────────

async function getHomeData(): Promise<HomePageData | null> {
  try {
    const res = await fetch(`${API_URL}/api/home`, {
      next: { revalidate: 300 },
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const data = await getHomeData();

  const services = data?.allServices ?? data?.featuredServices ?? [];
  const testimonials = data?.testimonials ?? [];
  const teamMembers = data?.teamMembers ?? [];

  return (
    <>
      {/* Hero carousel — SwiperHero with gradient slides */}
      <SwiperHero slides={HERO_SLIDES} autoplayDelay={6000} />

      {/* Services — InfiniteMarquee */}
      <section className="py-20 bg-dark-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <h2 className="section-title text-dark-900">
            Our <span className="text-primary-600">Services</span>
          </h2>
          <p className="section-subtitle">
            Comprehensive yoga programs and wellness solutions designed to support every stage of your practice.
          </p>
        </div>
        <InfiniteMarquee
          items={toMarqueeItems(services)}
          variant="service"
          speed={40}
          pauseOnHover
        />
        <div className="text-center mt-12">
          <Link href="/services/generative-ai" className="btn-primary">
            View All Services
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* About */}
      <AboutSection />

      {/* Testimonials — TestimonialCarousel */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="section-title text-dark-900">
            What Our <span className="text-primary-600">Clients Say</span>
          </h2>
          <p className="section-subtitle">
            Trusted by yoga practitioners of all levels — from first-timers to seasoned teachers.
          </p>
          <TestimonialCarousel
            testimonials={toTestimonialSlides(testimonials)}
            slidesPerView={3}
            autoplay
            autoplayDelay={5000}
          />
        </div>
      </section>

      {/* Case Studies */}
      <CaseStudiesSection caseStudies={data?.caseStudies ?? []} />

      {/* Industries */}
      <IndustriesSection industries={data?.industries ?? []} />

      {/* Video Demos */}
      <VideoDemoSection videos={data?.videoDemos ?? []} />

      {/* Team — TeacherCarousel */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="section-title text-dark-900">
            Meet Our <span className="text-primary-600">Teachers</span>
          </h2>
          <p className="section-subtitle">
            Passionate, certified yoga instructors dedicated to guiding your practice with care and expertise.
          </p>
          <TeacherCarousel
            teachers={toTeacherSlides(teamMembers)}
            slidesPerView={3}
            autoplay
            autoplayDelay={5000}
          />
        </div>
      </section>

      {/* Blog */}
      <BlogSection posts={data?.recentPosts ?? []} />

      {/* Newsletter */}
      <NewsletterSection />
    </>
  );
}
