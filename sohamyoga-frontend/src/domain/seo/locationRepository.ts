import { query } from '@/lib/postgres';

export interface Location {
  id: string;
  name: string;
  type: string;
  status: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone: string | null;
  email: string | null;
  timezone: string;
  maxCapacity: number;
}

interface Row {
  id: string; name: string; type: string; status: string;
  address_line1: string; address_line2: string | null; city: string; state: string; country: string;
  postal_code: string; phone: string | null; email: string | null; timezone: string; max_capacity: number;
}

function toEntity(r: Row): Location {
  return {
    id: r.id, name: r.name, type: r.type, status: r.status,
    addressLine1: r.address_line1, addressLine2: r.address_line2, city: r.city, state: r.state, country: r.country,
    postalCode: r.postal_code, phone: r.phone, email: r.email, timezone: r.timezone, maxCapacity: r.max_capacity,
  };
}

export async function listLocations(tenantId: string): Promise<Location[]> {
  const { rows } = await query<Row>('SELECT * FROM branch WHERE tenant_id = $1 ORDER BY created_at ASC', [tenantId]);
  return rows.map(toEntity);
}

export interface CreateLocationInput {
  name: string; type: string; addressLine1: string; addressLine2?: string | null; city: string; state: string;
  country: string; postalCode: string; phone?: string | null; email?: string | null; timezone: string; maxCapacity: number;
}

export async function createLocation(tenantId: string, input: CreateLocationInput): Promise<Location> {
  const { rows } = await query<Row>(
    `INSERT INTO branch (tenant_id, name, type, status, address_line1, address_line2, city, state, country, postal_code, phone, email, timezone, max_capacity)
     VALUES ($1,$2,$3,'pending_setup',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [tenantId, input.name, input.type, input.addressLine1, input.addressLine2 ?? null, input.city, input.state,
      input.country, input.postalCode, input.phone ?? null, input.email ?? null, input.timezone, input.maxCapacity]
  );
  return toEntity(rows[0]);
}

export async function updateLocationStatus(tenantId: string, id: string, status: string): Promise<Location | null> {
  const { rows } = await query<Row>(
    'UPDATE branch SET status = $3, updated_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING *',
    [id, tenantId, status]
  );
  return rows[0] ? toEntity(rows[0]) : null;
}
