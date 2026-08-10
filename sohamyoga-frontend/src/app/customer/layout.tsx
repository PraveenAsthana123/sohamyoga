'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { customerAuthApi, CustomerUser } from '@/lib/api';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);

  const publicPaths = ['/customer/login', '/customer/register'];

  useEffect(() => {
    if (publicPaths.includes(pathname)) {
      setLoading(false);
      return;
    }
    customerAuthApi
      .me()
      .then(setUser)
      .catch(() => router.push('/customer/login'))
      .finally(() => setLoading(false));
  }, [pathname]);

  const handleLogout = async () => {
    await customerAuthApi.logout();
    router.push('/customer/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (publicPaths.includes(pathname)) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <Link href="/" className="block">
            <span className="text-xl font-bold text-primary-700">SohamYoga</span>
          </Link>
          <p className="text-xs text-gray-500 mt-1">Customer Portal</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { href: '/customer/dashboard', label: 'Dashboard', icon: '📊' },
            { href: '/customer/blog', label: 'Blog & Resources', icon: '📖' },
            { href: '/customer/chat', label: 'My Chats', icon: '💬' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          {user && (
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-800">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
