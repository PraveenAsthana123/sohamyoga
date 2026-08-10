import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Careers — Join the SohamYoga Team',
  description:
    'Explore data engineering, AI/ML, and IT consulting career opportunities at SohamYoga. Join our growing team in Calgary, AB or remote across Canada.',
  openGraph: {
    title: 'Careers — Join the SohamYoga Team',
    description: 'Data engineering, AI/ML, and IT consulting roles. Hybrid & remote options across Canada.',
    images: [{ url: '/og-careers.png', width: 1200, height: 630, alt: 'SohamYoga Careers' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Careers at SohamYoga',
    description: 'Join our data engineering and AI/ML team. Calgary-based, Canada-wide opportunities.',
  },
};

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
