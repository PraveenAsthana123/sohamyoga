import LeftNav from '../../components/LeftNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <LeftNav />
      <main className="min-w-0 flex-1 overflow-x-auto">{children}</main>
    </div>
  );
}
