import QrLoginChallenge from '@/components/auth/QrLoginChallenge';
import Link from 'next/link';

export const metadata = {
  title: 'QR Kiosk Login · Soham Yoga',
  description: 'Sign into a kiosk or display by scanning a QR code with your authenticated Soham app.',
};

export default function QrLoginPage() {
  return (
    <main className="min-h-screen bg-yoga-hero flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-1">
            <span className="text-4xl">🧘</span>
            <span className="text-2xl font-black text-white">Soham Yoga</span>
            <span className="text-green-400 text-xs font-semibold tracking-widest uppercase">
              Kiosk Sign-In
            </span>
          </Link>
        </div>

        <QrLoginChallenge />

        <div className="mt-6 text-center space-y-1">
          <p className="text-white/30 text-xs">
            Don't have the app?{' '}
            <Link href="/customer/login" className="text-green-400 hover:text-green-300 transition-colors">
              Sign in with email →
            </Link>
          </p>
          <p className="text-white/20 text-xs">
            QR contains only a one-time challenge token — never a password or personal data.
          </p>
        </div>
      </div>
    </main>
  );
}
