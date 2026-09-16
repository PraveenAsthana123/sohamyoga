# API Standard — sohamyoga Platform

> **Version:** 2.0.0 · **Framework:** Next.js 14 App Router API Routes + FastAPI (AI Orchestrator)

## Route Naming Convention

```
/api/admin/[module]                     → Admin list/create
/api/admin/[module]/[id]               → Admin single item CRUD
/api/admin/[module]/seed               → Table creation + seed data
/api/admin/[module]/[action]           → Specific operation

/api/customer/[module]                  → Customer-facing (auth required)
/api/bot/[action]                       → Public bot (session-token gated)
/api/[public-resource]                  → Truly public (rate-limited)
```

## Response Envelope Standard

```typescript
// All responses use NextResponse.json() — never raw Response

// List response
{ items: T[], total: number, page?: number, limit?: number }

// Single item response  
{ item: T, message?: string }

// Create response (201)
{ item: T, message: 'Created successfully' }

// Error response
{ error: string }  // human-readable, no stack traces

// Async job response
{ status: 'started', message: 'Processing...', job_id?: string }
```

## Authentication Pattern

```typescript
// Admin routes — add at top of every handler
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult) return authResult; // returns 401/403 NextResponse

  // ... handler logic
}

// Customer routes — use requireCustomer()
// Public routes — no auth, but add rate limiting
// Bot routes — verify session_token from body/header
```

## Error Handling Pattern

```typescript
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Input validation
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Sanitize
    const name = sanitizeInput(body.name);

    // DB operation (parameterized)
    const { rows } = await pool.query(
      'INSERT INTO my_table (name) VALUES ($1) RETURNING *',
      [name]
    );

    return NextResponse.json({ item: rows[0] }, { status: 201 });

  } catch (error) {
    console.error('[POST /api/admin/my-module]', error);
    // Never expose error.message to client — it may contain DB internals
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## FastAPI Standard (AI Orchestrator — port 8100)

```python
# All AI Orchestrator endpoints follow:
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/agents", tags=["agents"])

class RunRequest(BaseModel):
    task: str
    context: dict = {}

@router.post("/content_agent/run")
async def run_content_agent(req: RunRequest) -> dict:
    """Run content agent with the given task."""
    try:
        result = await content_agent.run(req.task, req.context)
        return {"status": "success", "run_id": result.run_id, "output": result.output}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

## API Versioning

Current: **v1** (implicit — no version prefix in routes)  
When breaking changes needed: add `/api/v2/` prefix and maintain v1 for 6 months.

## Rate Limiting Implementation

```typescript
// src/lib/rate-limit.ts — apply to all public routes
const RATE_LIMIT_STORE = new Map<string, { count: number; reset: number }>();

export function checkRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = RATE_LIMIT_STORE.get(ip);
  if (!entry || now > entry.reset) {
    RATE_LIMIT_STORE.set(ip, { count: 1, reset: now + windowMs });
    return true; // allowed
  }
  if (entry.count >= limit) return false; // blocked
  entry.count++;
  return true;
}
```

## API Documentation

Every module's API routes must have JSDoc comments:

```typescript
/**
 * GET /api/admin/leads
 * Returns paginated leads list with optional filters.
 *
 * Query params:
 *   stage?: 'new'|'contacted'|'qualified'|'proposal'|'negotiation'|'won'|'lost'
 *   source?: string
 *   page?: number (default: 1)
 *   limit?: number (default: 50, max: 200)
 *
 * Returns: { items: Lead[], total: number, page: number }
 * Auth: Admin only
 */
export async function GET(req: NextRequest) { ... }
```
