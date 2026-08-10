import { ReactNode, HTMLAttributes } from 'react';

type GlassVariant = 'light' | 'dark' | 'green' | 'pricing' | 'video-overlay';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  children: ReactNode;
  hoverLift?: boolean;
  padding?: string;
}

const VARIANT_CLASS: Record<GlassVariant, string> = {
  light:         'glass',
  dark:          'glass-dark',
  green:         'glass-green',
  pricing:       'glass border-green-400/40 shadow-green-900/30',
  'video-overlay': 'glass-dark rounded-2xl',
};

export default function GlassCard({
  variant = 'light',
  children,
  hoverLift = false,
  padding = 'p-6',
  className = '',
  ...rest
}: GlassCardProps) {
  const base = VARIANT_CLASS[variant];
  const lift = hoverLift ? 'hover-lift cursor-pointer' : '';
  return (
    <div className={`${base} ${padding} ${lift} ${className}`} {...rest}>
      {children}
    </div>
  );
}
