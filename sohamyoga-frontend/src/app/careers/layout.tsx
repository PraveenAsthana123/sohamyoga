import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Careers — Join the SohamYoga Team',
  description:
    'Explore teaching and studio career opportunities at SohamYoga. Join our team in Calgary, AB.',
  openGraph: {
    title: 'Careers — Join the SohamYoga Team',
    description: 'Yoga instructor and studio roles in Calgary, AB.',
    images: [{ url: '/og-careers.png', width: 1200, height: 630, alt: 'SohamYoga Careers' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Careers at SohamYoga',
    description: 'Join our studio team. Calgary-based opportunities.',
  },
};

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
