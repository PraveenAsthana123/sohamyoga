'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="text-left w-full rounded px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
    >
      Log out
    </button>
  );
}
