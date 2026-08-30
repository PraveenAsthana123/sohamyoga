import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { resolveSession, SESSION_COOKIE } from '@/lib/auth';
import LogoutButton from '@/components/LogoutButton';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/contacts', label: 'Contacts' },
  { href: '/admin/forms', label: 'Forms' },
  { href: '/admin/scripts', label: 'Call Scripts' },
  { href: '/admin/calls', label: 'Call Log' },
  { href: '/admin/reports', label: 'Reports' },
];

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const principal = await resolveSession(token);
  if (!principal) redirect('/admin/login');

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-black/10 dark:border-white/10 p-4 flex flex-col gap-1">
        <div className="font-semibold text-lg mb-4">Voice Agent Ops</div>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            {item.label}
          </Link>
        ))}
        <div className="mt-auto pt-4 border-t border-black/10 dark:border-white/10 text-xs">
          <div className="mb-2 opacity-70">{principal.email}</div>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
