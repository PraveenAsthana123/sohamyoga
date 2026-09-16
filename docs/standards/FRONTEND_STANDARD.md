# Frontend Standard — sohamyoga Platform

> **Version:** 2.0.0 · **Framework:** Next.js 14 App Router · **Language:** TypeScript · **Styling:** Tailwind CSS

## File Structure Rules

```
src/app/admin/[module]/page.tsx          → Admin page (always 'use client')
src/app/admin/[module]/[id]/page.tsx     → Admin detail page
src/app/customer/[module]/page.tsx       → Customer page
src/app/api/admin/[module]/route.ts      → API route (server-side, no 'use client')
src/components/[ComponentName].tsx       → Shared UI components
src/lib/[module]-schema.ts              → DB schema + seed functions
src/cron/jobs/[JobName]Job.ts            → Cron job implementation
```

## TypeScript Requirements

```typescript
// MANDATORY: TypeScript strict — no `any`
// BAD:
const data: any = await res.json();
const items = data.items;  // no type safety

// GOOD:
interface Lead { id: number; first_name: string; lead_stage: string; }
interface LeadsResponse { items: Lead[]; total: number; }
const data: LeadsResponse = await res.json();
const items: Lead[] = data.items;

// Interface naming: PascalCase, no I-prefix
interface PlatformIntegrationConfig { ... }  // correct
interface IPlatformIntegrationConfig { ... } // wrong

// Props: inline interface, same file as component
interface MyComponentProps { items: Lead[]; onSelect: (id: number) => void; }
```

## Component Architecture

```typescript
// Page = 'use client' + state + fetch + tabs + content
// Component = pure UI, receives props, no fetch

// CORRECT structure:
'use client';
export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  // ... fetch + state management
  return <div><LeadTable leads={leads} /></div>;
}

// Pure component — no fetch, no state (or minimal local UI state)
function LeadTable({ leads }: { leads: Lead[] }) {
  return <table>...</table>;
}
```

## Tailwind Class Conventions

```typescript
// Status badges — consistent across all modules
const STATUS_CLASSES: Record<string, string> = {
  active:   'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-600',
  pending:  'bg-yellow-100 text-yellow-800',
  failed:   'bg-red-100 text-red-800',
  draft:    'bg-gray-100 text-gray-600',
  published:'bg-green-100 text-green-800',
  scheduled:'bg-blue-100 text-blue-800',
};

// Priority/severity badges
const SEVERITY_CLASSES: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 font-bold',
  high:     'bg-orange-100 text-orange-800',
  medium:   'bg-yellow-100 text-yellow-800',
  low:      'bg-gray-100 text-gray-600',
};

// KPI card (standard across all dashboards)
function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white border rounded-lg p-4 text-center">
      <div className={`text-3xl font-bold text-${color}-600`}>{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}
```

## Tab Navigation Pattern

```typescript
// Standard tab implementation — consistent across ALL pages
const TABS = ['Overview', 'Details', 'Settings', 'History'] as const;
type Tab = typeof TABS[number];
const [activeTab, setActiveTab] = useState<Tab>('Overview');

// Tab nav bar
<div className="flex gap-1 border-b border-gray-200 mb-6">
  {TABS.map(tab => (
    <button key={tab} onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
        activeTab === tab
          ? 'bg-white border border-b-white text-blue-600 -mb-px'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}>
      {tab}
    </button>
  ))}
</div>
```

## Loading & Error States

```typescript
// MANDATORY: Every page must handle loading + error states
if (loading) return (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
  </div>
);

if (error) return (
  <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
    <p className="text-red-700 font-medium">Error: {error}</p>
    <button onClick={() => window.location.reload()}
      className="mt-2 text-sm text-red-600 underline">Retry</button>
  </div>
);
```

## Navigation Registration

Every new page MUST register its nav link:

```typescript
// src/app/admin/layout.tsx — add to appropriate section
{ href: '/admin/my-module', label: '🎯 My Module', icon: <span>🎯</span>, requiredRoles: ['Admin'] }

// Sections (dividers):
// 🎯 Command Center (top)
// Content (blog, brand, market research)
// Social Platforms
// Marketing (leads, broadcast, surveys)
// Customer Service
// System (AI governance, monitoring, architecture)
```

## Performance Rules

```typescript
// RULE FE-PERF-1: Use debounce for search inputs (avoid request on every keystroke)
const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 400);
useEffect(() => { fetchWithFilter(debouncedSearch); }, [debouncedSearch]);

// RULE FE-PERF-2: Auto-refresh with setInterval — always clear on unmount
useEffect(() => {
  const interval = setInterval(fetchData, 60_000); // 60s refresh
  return () => clearInterval(interval);
}, []);

// RULE FE-PERF-3: Paginate tables > 50 rows
// RULE FE-PERF-4: Virtual scroll for tables > 200 rows (or use server pagination)
// RULE FE-PERF-5: Memoize expensive computations with useMemo
```

## Accessibility

```typescript
// Every interactive element must have:
// 1. Keyboard focus style (focus:ring-2 focus:ring-blue-500)
// 2. aria-label if icon-only button
// 3. role attribute for custom interactive elements
// 4. Alt text for all images

<button aria-label="Delete lead" className="... focus:ring-2 focus:ring-red-500">
  <TrashIcon />
</button>
```
