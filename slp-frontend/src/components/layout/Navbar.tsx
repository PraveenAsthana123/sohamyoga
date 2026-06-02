'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/services/generative-ai', label: 'Services' },
    { href: '/industries/banking-finance', label: 'Industries' },
    { href: '/blog', label: 'Blog' },
    { href: '/careers', label: 'Careers' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href.split('/').slice(0, 2).join('/'));
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-primary-700 ${
      isScrolled ? 'shadow-lg shadow-primary-900/20 py-2' : 'py-4'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/25 group-hover:shadow-primary-500/40 transition-shadow">
              <span className="text-white font-black text-sm">SLP</span>
            </div>
            <div className="text-xl font-bold tracking-tight text-white">
              <span className="text-accent-400">SLP</span> Systems
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3 py-2 text-sm font-medium transition-all duration-200 rounded-lg ${
                  isActive(link.href)
                    ? 'text-white bg-white/15'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/contact" className="ml-3 inline-flex items-center px-5 py-2.5 bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold rounded-lg transition-all duration-300 shadow-lg shadow-accent-500/30 hover:shadow-accent-500/50">
              Get Started
              <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button
            className="lg:hidden p-2 rounded-lg transition-colors hover:bg-white/10"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        <div className={`lg:hidden overflow-hidden transition-all duration-300 ${isMobileOpen ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
          <div className="pb-4 border-t border-white/20">
            <div className="flex flex-col gap-1 mt-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? 'text-white bg-white/15'
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/contact" className="px-4 py-2.5 bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold rounded-lg text-center mt-2">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
