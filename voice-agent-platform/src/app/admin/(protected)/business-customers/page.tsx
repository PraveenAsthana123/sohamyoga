import Link from 'next/link';
import { listBusinessCustomers } from '@/domain/customer/repository';

export const dynamic = 'force-dynamic';

// Admin list of every registered business -- lets staff manage a business's
// profile/contacts/scripts on their behalf when that business doesn't want
// to self-serve, same underlying data as /customer/dashboard.
export default async function BusinessCustomersListPage() {
  const customers = await listBusinessCustomers();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Business Customers</h1>
      {customers.length === 0 ? (
        <p className="text-sm opacity-60">No registered businesses yet.</p>
      ) : (
        <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-black/5 dark:bg-white/10 text-left">
              <tr><th className="p-2">Business</th><th className="p-2">Service type</th><th className="p-2">Email</th><th className="p-2">Registered</th></tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const json = c.toJSON();
                return (
                  <tr key={json.id} className="border-t border-black/10 dark:border-white/10">
                    <td className="p-2"><Link href={`/admin/business-customers/${json.id}`} className="underline">{json.businessName}</Link></td>
                    <td className="p-2 capitalize">{json.serviceType.replace('_', ' ')}</td>
                    <td className="p-2">{json.email}</td>
                    <td className="p-2 opacity-60">{new Date(json.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
