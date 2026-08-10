import type { Metadata } from 'next';
import './globals.css';
import LayoutWrapper from '@/components/layout/LayoutWrapper';
import LiveChatWidget from '@/components/chat/LiveChatWidget';
import AnalyticsProvider from '@/components/analytics/AnalyticsProvider';
import ConsentBanner from '@/components/analytics/ConsentBanner';
import PWARegister from '@/components/PWARegister';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sohamyoga.com';

export const metadata: Metadata = {
  icons: { icon: '/icon.svg' },
  title: {
    default: 'Soham Yoga — Yoga Products & Wellness',
    template: '%s | Soham Yoga',
  },
  description:
    'Soham Yoga offers premium yoga products, meditation supplies, and wellness accessories. Discover eco-friendly yoga mats, props, and everything for your practice.',
  keywords: [
    'Yoga Products', 'Yoga Mats', 'Meditation', 'Wellness', 'Yoga Accessories',
    'Soham Yoga', 'Yoga Props', 'Meditation Supplies', 'Eco-Friendly Yoga',
  ],
  metadataBase: new URL(siteUrl),
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Soham Yoga',
    title: 'Soham Yoga — Yoga Products & Wellness',
    description:
      'Premium yoga products, meditation supplies, and wellness accessories for every yogi. Eco-friendly and sustainably sourced.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Soham Yoga — Yoga Products & Wellness',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Soham Yoga — Yoga Products & Wellness',
    description:
      'Premium yoga products, meditation supplies, and wellness accessories for every yogi.',
    images: ['/og-image.png'],
    creator: '@sohamyoga',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  verification: {
    // Add your Google Search Console, Bing, etc. verification codes here:
    // google: 'your-google-verification-code',
  },
  other: {
    // LinkedIn Insight Tag (replace with your partner ID):
    // 'linkedin:partner_id': '1234567',
    // Facebook Domain Verification:
    // 'facebook-domain-verification': 'your-code',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="sr-skip-link">Skip to main content</a>
        <AnalyticsProvider>
          <div id="main-content"><LayoutWrapper>{children}</LayoutWrapper></div>
          <LiveChatWidget />
          <ConsentBanner />
          <PWARegister />
        </AnalyticsProvider>
      </body>
    </html>
  );
}
