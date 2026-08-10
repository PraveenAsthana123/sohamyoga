'use client';

import { useEffect, useMemo, useState } from 'react';

type Column = { column_name: string; data_type: string; is_nullable: string; column_default: string | null; is_primary: boolean; foreign_target: string | null };
type Table = { schema: string; name: string; columns: Column[] };
type Catalog = { summary: Record<string, number>; tables: Table[]; views: Array<{ schema_name: string; view_name: string }> };

export default function SchemaCatalogPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [schema, setSchema] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { fetch('/api/admin/schema-catalog', { cache: 'no-store' }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Unable to load schema'); setCatalog(data); }).catch(e => setError(e.message)); }, []);
  const schemas = useMemo(() => Array.from(new Set((catalog?.tables || []).map(t => t.schema))).sort(), [catalog]);
  const filtered = useMemo(() => (catalog?.tables || []).filter(t => (schema === 'all' || t.schema === schema) && `${t.schema}.${t.name} ${t.columns.map(c => c.column_name).join(' ')}`.toLowerCase().includes(search.toLowerCase())), [catalog, schema, search]);

  return <div className="mx-auto max-w-7xl space-y-5 p-6">
    <header><h1 className="text-2xl font-bold">Database Schema Catalogue</h1><p className="text-sm text-gray-500">Live PostgreSQL tables, primary keys, references, columns and views for every module.</p></header>
    {error && <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{Object.entries(catalog?.summary || {}).map(([name,value]) => <div key={name} className="rounded-xl border bg-white p-4"><div className="text-xs uppercase text-gray-500">{name}</div><div className="text-xl font-bold">{value}</div></div>)}</section>
    <section className="flex flex-col gap-2 rounded-xl border bg-white p-4 md:flex-row"><input className="flex-1 rounded border px-3 py-2 text-sm" placeholder="Search table or column" value={search} onChange={e => setSearch(e.target.value)}/><select className="rounded border px-3 py-2 text-sm" value={schema} onChange={e => setSchema(e.target.value)}><option value="all">All schemas</option>{schemas.map(s => <option key={s}>{s}</option>)}</select></section>
    <section className="space-y-2">{filtered.map(table => { const key=`${table.schema}.${table.name}`; return <div key={key} className="overflow-hidden rounded-xl border bg-white"><button className="flex w-full items-center justify-between p-4 text-left" onClick={() => setExpanded(expanded === key ? null : key)}><span><strong>{table.name}</strong><span className="ml-2 text-xs text-gray-500">{table.schema} · {table.columns.length} columns</span></span><span>{expanded === key ? '−' : '+'}</span></button>{expanded === key && <div className="overflow-auto border-t"><table className="w-full text-sm"><thead><tr className="bg-gray-50 text-left text-xs"><th className="p-2">Column</th><th>Type</th><th>Required</th><th>Key/reference</th><th>Default</th></tr></thead><tbody>{table.columns.map(c => <tr key={c.column_name} className="border-t"><td className="p-2 font-mono text-xs">{c.column_name}</td><td>{c.data_type}</td><td>{c.is_nullable === 'NO' ? 'Yes' : 'No'}</td><td>{c.is_primary ? 'PRIMARY KEY' : c.foreign_target ? `→ ${c.foreign_target}` : ''}</td><td className="max-w-xs truncate font-mono text-xs">{c.column_default || ''}</td></tr>)}</tbody></table></div>}</div>; })}</section>
    {catalog && <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Views ({catalog.views.length})</h2><div className="mt-2 flex flex-wrap gap-2">{catalog.views.map(v => <span key={`${v.schema_name}.${v.view_name}`} className="rounded bg-gray-100 px-2 py-1 font-mono text-xs">{v.schema_name}.{v.view_name}</span>)}</div></section>}
  </div>;
}
