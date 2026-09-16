import { NextRequest } from 'next/server';
import { affiliateDestination } from '@/domain/referral/AffiliateDestination';
import { GET } from '@/app/r/[code]/route';
import { POST } from '@/app/api/admin/vendors/[id]/affiliate-links/route';
import { databaseConfigured, transaction, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

jest.mock('@/lib/postgres', () => ({ databaseConfigured: jest.fn(), transaction: jest.fn(), query: jest.fn() }));
jest.mock('@/lib/admin-auth', () => ({ requireAdmin: jest.fn() }));
const sql = jest.fn();
const base = 'https://portal.example/r/AFF-TEST';
beforeEach(() => {
  jest.resetAllMocks();
  (databaseConfigured as jest.Mock).mockReturnValue(true);
  (transaction as jest.Mock).mockImplementation(fn => fn({ query: sql }));
  (requireAdmin as jest.Mock).mockResolvedValue(null);
});

test.each(['//evil.example', '/\\evil.example', '/\n/evil.example', 'https://evil.example', '/\t/evil.example', 123, null])('rejects unsafe destination %p', path => {
  expect(affiliateDestination(path, base)).toBeNull();
});
test('preserves product path, query and fragment on this origin', () => {
  expect(affiliateDestination('/catalog/yoga?source=offer#details', base)?.href)
    .toBe('https://portal.example/catalog/yoga?source=offer#details');
});
test('tracks an eligible click and redirects with attribution', async () => {
  sql.mockResolvedValueOnce({ rowCount: 1, rows: [{ id:'id', destination_path:'/catalog/yoga?x=1' }] }).mockResolvedValueOnce({ rowCount:1, rows:[{id:'d894e787-cd8c-47ea-9909-e3125c147639'}] });
  const response = await GET(new NextRequest(base, { headers: { 'x-forwarded-for':'bad:ip', 'user-agent':'test' } }), { params:{code:'AFF-TEST'} });
  expect(response.headers.get('location')).toBe('https://portal.example/catalog/yoga?x=1&ref=AFF-TEST');
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  expect(response.headers.get('set-cookie')).toContain('SameSite=lax');
  expect(sql.mock.calls[1][1]).toEqual(['id',null,'test','direct_link']);
});
test('ineligible code cannot attach attribution or create a click event', async () => {
  sql.mockResolvedValueOnce({ rowCount:0, rows:[] });
  const response = await GET(new NextRequest(base), { params:{code:'AFF-TEST'} });
  expect(response.headers.get('location')).toBe('https://portal.example/customer/register');
  expect(sql).toHaveBeenCalledTimes(1);
});
test('legacy unsafe destination stays on portal', async () => {
  sql.mockResolvedValueOnce({ rowCount:1, rows:[{ id:'id', destination_path:'/\\evil.example' }] }).mockResolvedValueOnce({rows:[{id:'d894e787-cd8c-47ea-9909-e3125c147639'}]});
  const response = await GET(new NextRequest(base), { params:{code:'AFF-TEST'} });
  expect(response.headers.get('location')).toBe('https://portal.example/customer/register?ref=AFF-TEST');
});
test('event failure propagates so the transaction can roll back', async () => {
  sql.mockResolvedValueOnce({ rowCount:1, rows:[{id:'id',destination_path:null}] }).mockRejectedValueOnce(new Error('insert failed'));
  await expect(GET(new NextRequest(base), {params:{code:'AFF-TEST'}})).rejects.toThrow('insert failed');
});
test.each([42, {}, '/\\evil.example', '//evil.example'])('creation rejects malformed destination %p', async destinationPath => {
  const response = await POST(new NextRequest('https://portal.example/api/admin/vendors/v/affiliate-links', {
    method:'POST', body:JSON.stringify({destinationPath}), headers:{'content-type':'application/json'},
  }), {params:Promise.resolve({id:'v'})});
  expect(response.status).toBe(400);
  expect(query).not.toHaveBeenCalled();
});
