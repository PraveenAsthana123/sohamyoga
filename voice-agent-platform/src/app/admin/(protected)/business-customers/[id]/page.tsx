import { notFound } from 'next/navigation';
import { getBusinessCustomer } from '@/domain/customer/repository';
import BusinessDetailClient from './BusinessDetailClient';

export const dynamic = 'force-dynamic';

export default async function BusinessCustomerDetailPage({ params }: { params: { id: string } }) {
  const customer = await getBusinessCustomer(params.id);
  if (!customer) notFound();
  const json = customer.toJSON();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{json.businessName}</h1>
        <p className="text-sm opacity-60 capitalize">{json.serviceType.replace('_', ' ')} · {json.email}</p>
      </div>
      <BusinessDetailClient businessId={json.id} />
    </div>
  );
}
