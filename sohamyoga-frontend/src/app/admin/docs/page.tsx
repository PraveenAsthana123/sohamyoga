'use client';

import { useState } from 'react';

type TabKey = 'brd' | 'hld' | 'lld' | 'sad' | 'c4' | 'techstack';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'brd', label: 'BRD' },
  { key: 'hld', label: 'HLD' },
  { key: 'lld', label: 'LLD' },
  { key: 'sad', label: 'SAD' },
  { key: 'c4', label: 'C4 Model' },
  { key: 'techstack', label: 'Tech Stack' },
];

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('brd');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-900">Documentation</h1>
        <p className="text-dark-500 mt-1">System architecture and design documents</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-dark-200">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-dark-500 hover:text-dark-700 hover:border-dark-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border border-dark-200 p-8 prose-content">
        {activeTab === 'brd' && <BRDContent />}
        {activeTab === 'hld' && <HLDContent />}
        {activeTab === 'lld' && <LLDContent />}
        {activeTab === 'sad' && <SADContent />}
        {activeTab === 'c4' && <C4Content />}
        {activeTab === 'techstack' && <TechStackContent />}
      </div>
    </div>
  );
}

function BRDContent() {
  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-dark-900 mb-6">Business Requirements Document</h2>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-dark-800 mb-3">1. Executive Summary</h3>
        <p className="text-dark-600 mb-4">
          SohamYoga is an IT management and consulting firm based in Calgary, Alberta, specializing in AI/ML solutions,
          digital transformation, and managed IT services. This platform serves as the company&apos;s digital presence,
          providing service information, blog content, case studies, and client engagement tools.
        </p>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-dark-800 mb-3">2. Business Objectives</h3>
        <ul className="list-disc pl-6 text-dark-600 space-y-2">
          <li>Establish a professional online presence showcasing AI/ML and IT consulting services</li>
          <li>Generate leads through contact forms, chat widgets, and newsletter subscriptions</li>
          <li>Demonstrate thought leadership through blog content across multiple technology domains</li>
          <li>Provide self-service information about industry-specific solutions</li>
          <li>Enable admin team to manage all content without developer intervention</li>
        </ul>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-dark-800 mb-3">3. Stakeholders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-dark-200">
            <thead className="bg-dark-50">
              <tr>
                <th className="px-4 py-2 text-left border-b">Role</th>
                <th className="px-4 py-2 text-left border-b">Responsibility</th>
                <th className="px-4 py-2 text-left border-b">Access Level</th>
              </tr>
            </thead>
            <tbody className="text-dark-600">
              <tr className="border-b"><td className="px-4 py-2">Admin</td><td className="px-4 py-2">Full system management</td><td className="px-4 py-2">All features</td></tr>
              <tr className="border-b"><td className="px-4 py-2">Editor</td><td className="px-4 py-2">Content management</td><td className="px-4 py-2">Blog, Services, Testimonials, Case Studies, Videos, Team</td></tr>
              <tr className="border-b"><td className="px-4 py-2">HR</td><td className="px-4 py-2">Team management</td><td className="px-4 py-2">Team, Users</td></tr>
              <tr><td className="px-4 py-2">Sales</td><td className="px-4 py-2">Lead management</td><td className="px-4 py-2">Messages, Chat Requests, Newsletter</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-dark-800 mb-3">4. Functional Requirements</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-dark-700">FR-01: Service Showcase</h4>
            <p className="text-dark-600 text-sm">Display 18+ IT services across categories (AI/ML, IT Services, AI Enablement, Technology) with detail pages.</p>
          </div>
          <div>
            <h4 className="font-medium text-dark-700">FR-02: Blog Platform</h4>
            <p className="text-dark-600 text-sm">Category-based blog with 11+ categories, SEO-optimized, search, pagination, rich content.</p>
          </div>
          <div>
            <h4 className="font-medium text-dark-700">FR-03: Lead Generation</h4>
            <p className="text-dark-600 text-sm">Contact forms, chat widget with service request routing, newsletter subscriptions.</p>
          </div>
          <div>
            <h4 className="font-medium text-dark-700">FR-04: Admin CMS</h4>
            <p className="text-dark-600 text-sm">Full CRUD for all entities, role-based access, dashboard analytics, monitoring tools.</p>
          </div>
          <div>
            <h4 className="font-medium text-dark-700">FR-05: Industry Solutions</h4>
            <p className="text-dark-600 text-sm">Dedicated pages for Banking, Oil & Gas, Public Sector, Transportation verticals.</p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-dark-800 mb-3">5. Non-Functional Requirements</h3>
        <ul className="list-disc pl-6 text-dark-600 space-y-2">
          <li><strong>Performance:</strong> Page load &lt; 3s, API response &lt; 500ms for 95th percentile</li>
          <li><strong>Security:</strong> OWASP Top 10 compliance, rate limiting, security headers, RBAC</li>
          <li><strong>SEO:</strong> Server-side rendering, meta tags, structured data, sitemap</li>
          <li><strong>Availability:</strong> 99.5% uptime target</li>
          <li><strong>Scalability:</strong> Support 10,000 concurrent users</li>
        </ul>
      </section>
    </div>
  );
}

function HLDContent() {
  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-dark-900 mb-6">High-Level Design</h2>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-dark-800 mb-3">1. Architecture Overview</h3>
        <pre className="bg-dark-900 text-green-400 p-6 rounded-lg text-xs font-mono overflow-x-auto">{`
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Browser     │  │  Mobile  │  │  Search Engines   │  │
│  │  (Next.js)   │  │  (PWA)   │  │  (Crawler/SSR)    │  │
│  └──────┬───────┘  └────┬─────┘  └─────────┬─────────┘  │
└─────────┼───────────────┼───────────────────┼────────────┘
          │               │                   │
          ▼               ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│                  FRONTEND LAYER                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │            Next.js 14 (App Router)                │   │
│  │  ┌────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐ │   │
│  │  │  SSR   │ │   ISR    │ │  CSR   │ │  API    │ │   │
│  │  │ Pages  │ │  Cache   │ │ Admin  │ │ Routes  │ │   │
│  │  └────────┘ └──────────┘ └────────┘ └─────────┘ │   │
│  └──────────────────────┬───────────────────────────┘   │
└─────────────────────────┼───────────────────────────────┘
                          │  REST API (JSON)
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   BACKEND LAYER                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │          .NET 8 Web API                           │   │
│  │  ┌───────────────────────────────────────────┐   │   │
│  │  │              MIDDLEWARE PIPELINE            │   │   │
│  │  │  Correlation → Exception → Security →     │   │   │
│  │  │  RateLimit → Auth → API Tracking → Log    │   │   │
│  │  └───────────────────────────────────────────┘   │   │
│  │  ┌────────────┐ ┌──────────┐ ┌───────────────┐  │   │
│  │  │ Controllers│ │ Services │ │  Repositories  │  │   │
│  │  │  (HTTP)    │→│ (Logic)  │→│  (Data Access) │  │   │
│  │  └────────────┘ └──────────┘ └───────┬───────┘  │   │
│  └──────────────────────────────────────┼───────────┘   │
└─────────────────────────────────────────┼───────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────┐
│                    DATA LAYER                            │
│  ┌──────────────────┐  ┌─────────────────────────────┐  │
│  │  SQLite (EF Core) │  │  File System (Logs, Images) │  │
│  │  ─ 14 Entities    │  │  ─ Serilog JSON Logs        │  │
│  │  ─ WAL Mode       │  │  ─ Uploaded Assets           │  │
│  │  ─ Auto Cleanup   │  │                              │  │
│  └──────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
        `}</pre>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-dark-800 mb-3">2. Key Design Decisions</h3>
        <div className="space-y-3">
          <div className="bg-dark-50 p-4 rounded-lg">
            <h4 className="font-medium text-dark-800">SQLite over PostgreSQL</h4>
            <p className="text-dark-600 text-sm mt-1">Single-file deployment, zero configuration, sufficient for expected load. WAL mode for concurrent reads.</p>
          </div>
          <div className="bg-dark-50 p-4 rounded-lg">
            <h4 className="font-medium text-dark-800">Next.js ISR over SSR</h4>
            <p className="text-dark-600 text-sm mt-1">Incremental Static Regeneration provides SEO benefits with reduced server load. 5-minute revalidation for content pages.</p>
          </div>
          <div className="bg-dark-50 p-4 rounded-lg">
            <h4 className="font-medium text-dark-800">Cookie Auth over JWT</h4>
            <p className="text-dark-600 text-sm mt-1">HttpOnly cookies with SameSite=None for cross-origin. Simpler session management, automatic CSRF protection.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function LLDContent() {
  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-dark-900 mb-6">Low-Level Design</h2>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-dark-800 mb-3">1. Entity Relationship Diagram</h3>
        <pre className="bg-dark-900 text-green-400 p-6 rounded-lg text-xs font-mono overflow-x-auto">{`
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  BlogCategory │──1:N──│   BlogPost   │     │   Service    │
│──────────────│     │──────────────│     │──────────────│
│ Id           │     │ Id           │     │ Id           │
│ Name         │     │ Title        │     │ Title        │
│ Slug (UK)    │     │ Slug (UK)    │     │ Slug (UK)    │
│ Description  │     │ Content      │     │ Category     │
└──────────────┘     │ CategoryId(FK│     │ Features     │
                     │ AuthorName   │     │ IsFeatured   │
                     │ IsPublished  │     └──────────────┘
                     └──────────────┘
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ ContactMessage│     │  ChatRequest │     │  Newsletter  │
│──────────────│     │──────────────│     │  Subscriber  │
│ Id           │     │ Id           │     │──────────────│
│ Name, Email  │     │ Name, Email  │     │ Id           │
│ Subject      │     │ RequestType  │     │ Email (UK)   │
│ Message      │     │ ServiceIntrst│     │ Token (UK)   │
│ IsRead       │     │ IsResolved   │     │ IsActive     │
│ IsArchived   │     │ AssignedTo   │     └──────────────┘
└──────────────┘     └──────────────┘
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Testimonial │     │  CaseStudy   │     │  TeamMember  │
│──────────────│     │──────────────│     │──────────────│
│ Id           │     │ Id           │     │ Id           │
│ AuthorName   │     │ Title        │     │ Name         │
│ Company      │     │ Slug (UK)    │     │ Title        │
│ Quote        │     │ FullContent  │     │ Bio          │
│ Rating       │     │ Tag          │     │ SortOrder    │
└──────────────┘     └──────────────┘     └──────────────┘
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   AuditLog   │     │ ApiRequestLog│     │ IndustrySoln │
│──────────────│     │──────────────│     │──────────────│
│ Action       │     │ Method       │     │ Title        │
│ EntityType   │     │ Path         │     │ Slug (UK)    │
│ UserId       │     │ StatusCode   │     │ Challenges   │
│ Details(JSON)│     │ DurationMs   │     │ Solutions    │
│ IpAddress    │     │ ClientIp     │     │ IsActive     │
└──────────────┘     └──────────────┘     └──────────────┘
        `}</pre>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-dark-800 mb-3">2. API Endpoint Inventory</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-dark-200">
            <thead className="bg-dark-50">
              <tr>
                <th className="px-3 py-2 text-left border-b">Method</th>
                <th className="px-3 py-2 text-left border-b">Endpoint</th>
                <th className="px-3 py-2 text-left border-b">Auth</th>
                <th className="px-3 py-2 text-left border-b">Description</th>
              </tr>
            </thead>
            <tbody className="text-dark-600">
              {[
                ['GET', '/api/home', 'Public', 'Home page aggregate data'],
                ['GET', '/api/services', 'Public', 'All services'],
                ['GET', '/api/blog', 'Public', 'Paginated blog posts'],
                ['GET', '/api/blog/categories', 'Public', 'All categories'],
                ['POST', '/api/contact', 'Public', 'Submit contact form'],
                ['POST', '/api/chat-requests', 'Public', 'Submit chat request'],
                ['POST', '/api/newsletter/subscribe', 'Public', 'Subscribe to newsletter'],
                ['POST', '/api/auth/login', 'Public', 'Admin login'],
                ['GET', '/api/admin/dashboard', 'Admin', 'Dashboard stats'],
                ['GET', '/api/admin/monitoring/*', 'Admin', 'System monitoring'],
                ['GET', '/api/health', 'Public', 'Health check'],
              ].map(([method, path, auth, desc], i) => (
                <tr key={i} className="border-b">
                  <td className="px-3 py-1.5"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${method === 'GET' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{method}</span></td>
                  <td className="px-3 py-1.5 font-mono">{path}</td>
                  <td className="px-3 py-1.5">{auth}</td>
                  <td className="px-3 py-1.5">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-dark-800 mb-3">3. Middleware Pipeline Order</h3>
        <ol className="list-decimal pl-6 text-dark-600 space-y-1 text-sm">
          <li>Response Compression</li>
          <li>Correlation ID (generates unique request ID)</li>
          <li>Global Exception Handler (catches all unhandled exceptions)</li>
          <li>Security Headers (CSP, HSTS, X-Frame-Options)</li>
          <li>Rate Limiting (per-IP, 100 req/60s)</li>
          <li>HTTPS Redirection</li>
          <li>Static Files</li>
          <li>CORS</li>
          <li>Authentication + Authorization</li>
          <li>API Request Tracking (logs method, path, status, duration)</li>
          <li>Serilog Request Logging</li>
        </ol>
      </section>
    </div>
  );
}

function SADContent() {
  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-dark-900 mb-6">Software Architecture Document</h2>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-dark-800 mb-3">1. Architectural Patterns</h3>
        <div className="space-y-4">
          <div className="bg-dark-50 p-4 rounded-lg">
            <h4 className="font-medium text-dark-800">Repository + Unit of Work Pattern</h4>
            <p className="text-dark-600 text-sm mt-1">
              All data access is abstracted through repositories. The UnitOfWork class coordinates transactions across
              multiple repositories, ensuring atomic operations. 12 repositories cover all entity types.
            </p>
          </div>
          <div className="bg-dark-50 p-4 rounded-lg">
            <h4 className="font-medium text-dark-800">Service Layer Pattern</h4>
            <p className="text-dark-600 text-sm mt-1">
              Business logic resides in service classes (BlogService, ContactService, etc.). Controllers are thin HTTP
              adapters that delegate to services. Services throw domain exceptions, never HTTP exceptions.
            </p>
          </div>
          <div className="bg-dark-50 p-4 rounded-lg">
            <h4 className="font-medium text-dark-800">Custom Exception Hierarchy</h4>
            <p className="text-dark-600 text-sm mt-1">
              AppException base class with subtypes: NotFoundException (404), ValidationException (400),
              ConflictException (409), UnauthorizedException (401), ForbiddenException (403). Global middleware
              maps these to consistent JSON error envelopes.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-dark-800 mb-3">2. Security Architecture</h3>
        <ul className="list-disc pl-6 text-dark-600 space-y-2 text-sm">
          <li><strong>Authentication:</strong> ASP.NET Identity with cookie-based auth. HttpOnly, Secure, SameSite=None.</li>
          <li><strong>Authorization:</strong> Role-based (Admin, Editor, HR, Sales). [Authorize] attributes on controllers.</li>
          <li><strong>Rate Limiting:</strong> Per-IP rate limiting, 100 requests per 60 seconds. Configurable via appsettings.</li>
          <li><strong>Security Headers:</strong> X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy.</li>
          <li><strong>Input Validation:</strong> Data annotations on models, Pydantic-style validation in services.</li>
          <li><strong>CORS:</strong> Restricted origins list from configuration. Never allow_origins=*.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-dark-800 mb-3">3. Data Flow</h3>
        <pre className="bg-dark-900 text-green-400 p-6 rounded-lg text-xs font-mono overflow-x-auto">{`
Client Request Flow:
  Browser → Next.js (SSR/ISR) → .NET API → Service → Repository → SQLite
                                    ↓
                             Middleware Pipeline:
                      CorrelationId → ExceptionHandler →
                      SecurityHeaders → RateLimit → Auth →
                      ApiTracking → SerilogLogging

Admin Action Flow:
  Admin Panel → Auth Check → API Call → Service (validate) →
  Repository (persist) → AuditLog (record change) → Response
        `}</pre>
      </section>
    </div>
  );
}

function C4Content() {
  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-dark-900 mb-6">C4 Model</h2>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-dark-800 mb-3">Level 1 — System Context</h3>
        <pre className="bg-dark-900 text-green-400 p-6 rounded-lg text-xs font-mono overflow-x-auto">{`
                    ┌───────────────┐
                    │   Visitor     │
                    │   (Person)    │
                    └───────┬───────┘
                            │ Browses website,
                            │ submits forms
                            ▼
                    ┌───────────────┐
                    │  SohamYoga  │
                    │   Platform    │───── Sends email ────▶ [SMTP Server]
                    │  (Software)   │
                    └───────┬───────┘
                            │
                    ┌───────┴───────┐
                    │  Admin User   │
                    │   (Person)    │
                    │  Manages CMS  │
                    └───────────────┘
        `}</pre>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-dark-800 mb-3">Level 2 — Container Diagram</h3>
        <pre className="bg-dark-900 text-green-400 p-6 rounded-lg text-xs font-mono overflow-x-auto">{`
┌─────────────────────────────────────────────────────────────┐
│                     SohamYoga Platform                     │
│                                                              │
│  ┌────────────────────┐      ┌────────────────────────┐     │
│  │   Next.js Frontend  │      │   .NET 8 Web API       │     │
│  │   (Container)       │─────▶│   (Container)          │     │
│  │                     │ REST │                         │     │
│  │ - Public pages (SSR)│      │ - 14 Controllers        │     │
│  │ - Admin panel (CSR) │      │ - 5 Services            │     │
│  │ - Chat widget       │      │ - 12 Repositories       │     │
│  │ - SEO optimization  │      │ - 6 Middleware           │     │
│  └────────────────────┘      │ - Identity Auth          │     │
│                               └───────────┬────────────┘     │
│                                           │                  │
│                               ┌───────────▼────────────┐     │
│                               │   SQLite Database      │     │
│                               │   (Container)          │     │
│                               │                         │     │
│                               │ - 14 Entity tables      │     │
│                               │ - Identity tables        │     │
│                               │ - WAL mode enabled      │     │
│                               │ - Auto-cleanup service  │     │
│                               └─────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
        `}</pre>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-dark-800 mb-3">Level 3 — Component Diagram (API)</h3>
        <pre className="bg-dark-900 text-green-400 p-6 rounded-lg text-xs font-mono overflow-x-auto">{`
┌─────────────────────────────────────────────────────────┐
│                   .NET 8 Web API                         │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                MIDDLEWARE STACK                     │  │
│  │  Correlation → Exception → Security → RateLimit    │  │
│  │  → Auth → ApiTracking → SerilogLogging             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Controllers  │  │   Services   │  │ Repositories │  │
│  │──────────────│  │──────────────│  │──────────────│  │
│  │ Home         │  │ BlogService  │  │ BlogRepo     │  │
│  │ Blog         │→│ ContactSvc   │→│ ContactRepo  │  │
│  │ Services     │  │ NewsletterSvc│  │ ServiceRepo  │  │
│  │ Contact      │  │ EmailService │  │ ... (12)     │  │
│  │ Auth         │  │ SiteService  │  │              │  │
│  │ ChatRequests │  └──────────────┘  └──────────────┘  │
│  │ Admin*       │         │                  │          │
│  │ Monitoring   │         ▼                  ▼          │
│  └──────────────┘  ┌──────────────┐  ┌──────────────┐  │
│                    │  Exceptions  │  │  UnitOfWork  │  │
│                    │──────────────│  │──────────────│  │
│                    │ AppException │  │ Coordinates  │  │
│                    │ NotFound     │  │ transactions │  │
│                    │ Validation   │  │ across repos │  │
│                    │ Conflict     │  └──────────────┘  │
│                    └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
        `}</pre>
      </section>
    </div>
  );
}

function TechStackContent() {
  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-dark-900 mb-6">Technology Stack</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-dark-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-dark-800 mb-4">Backend</h3>
          <div className="space-y-3">
            {[
              { name: '.NET 8', desc: 'Runtime & Web API framework' },
              { name: 'Entity Framework Core 8', desc: 'ORM with code-first migrations' },
              { name: 'SQLite', desc: 'Embedded database with WAL mode' },
              { name: 'ASP.NET Identity', desc: 'Authentication & role management' },
              { name: 'Serilog', desc: 'Structured logging with correlation IDs' },
              { name: 'Swashbuckle', desc: 'OpenAPI/Swagger documentation' },
            ].map((tech) => (
              <div key={tech.name} className="flex justify-between items-start">
                <span className="font-medium text-dark-800 text-sm">{tech.name}</span>
                <span className="text-dark-500 text-xs text-right ml-4">{tech.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-dark-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-dark-800 mb-4">Frontend</h3>
          <div className="space-y-3">
            {[
              { name: 'Next.js 14', desc: 'React framework with App Router' },
              { name: 'React 18', desc: 'UI component library' },
              { name: 'TypeScript', desc: 'Type-safe JavaScript' },
              { name: 'Tailwind CSS 3', desc: 'Utility-first CSS framework' },
              { name: 'ESLint 8', desc: 'Code quality & linting' },
            ].map((tech) => (
              <div key={tech.name} className="flex justify-between items-start">
                <span className="font-medium text-dark-800 text-sm">{tech.name}</span>
                <span className="text-dark-500 text-xs text-right ml-4">{tech.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-dark-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-dark-800 mb-4">Architecture Patterns</h3>
          <div className="space-y-3">
            {[
              { name: 'Repository Pattern', desc: 'Data access abstraction' },
              { name: 'Unit of Work', desc: 'Transaction coordination' },
              { name: 'Service Layer', desc: 'Business logic encapsulation' },
              { name: 'Middleware Pipeline', desc: 'Cross-cutting concerns' },
              { name: 'ISR (Next.js)', desc: 'Incremental Static Regeneration' },
            ].map((tech) => (
              <div key={tech.name} className="flex justify-between items-start">
                <span className="font-medium text-dark-800 text-sm">{tech.name}</span>
                <span className="text-dark-500 text-xs text-right ml-4">{tech.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-dark-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-dark-800 mb-4">Security & Monitoring</h3>
          <div className="space-y-3">
            {[
              { name: 'Rate Limiting', desc: 'Per-IP request throttling' },
              { name: 'Security Headers', desc: 'CSP, HSTS, X-Frame-Options' },
              { name: 'RBAC', desc: 'Admin, Editor, HR, Sales roles' },
              { name: 'API Request Tracking', desc: 'Performance monitoring' },
              { name: 'Audit Logging', desc: 'Admin action trail' },
              { name: 'Background Cleanup', desc: 'Auto-purge old logs' },
            ].map((tech) => (
              <div key={tech.name} className="flex justify-between items-start">
                <span className="font-medium text-dark-800 text-sm">{tech.name}</span>
                <span className="text-dark-500 text-xs text-right ml-4">{tech.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
