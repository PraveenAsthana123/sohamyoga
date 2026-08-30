import type { Metadata } from 'next';
import './globals.css';
import UiErrorReporter from '../components/UiErrorReporter';

export const metadata: Metadata = {
  title: 'Market Research Portal',
  description: 'Standalone 17-phase market research & forecasting pipeline',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <UiErrorReporter />
        {children}
      </body>
    </html>
  );
}
