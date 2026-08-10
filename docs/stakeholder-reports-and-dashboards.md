# Stakeholder reports and dashboards

All reports must be tenant-scoped, role-authorized, timezone-aware, export-audited, and generated from measured database events. External reports require approval before delivery.

| Stakeholder | Internal operational reports | Health/control reports | External reports | Dashboard |
|---|---|---|---|---|
| Platform super-admin | tenant growth, feature adoption, support backlog, job throughput | service uptime, queue depth, failed jobs, DB health, security alerts, token/cost avoidance | platform SLA and compliance pack | global operations and tenant health |
| Tenant administrator | users, roles, campaigns, approvals, channel connections | integration status, token expiry, failed publications, audit exceptions | monthly business review, customer engagement | tenant executive command centre |
| Organization owner | revenue, pipeline, campaign ROI, employee productivity | subscription, billing, data quality, risk indicators | board/investor summary, tax/accounting export | organization performance |
| Marketing manager | content calendar, asset production, approvals, channel performance | provider connectivity, rejected content, schedule failures | client campaign report, social performance | marketing command centre |
| Content creator | assigned briefs, drafts, revisions, asset turnaround | rendering failures, model quality, pending reviews | approved portfolio/delivery report | creator workbench |
| Sales/CRM user | leads, funnel, conversion, attribution, follow-ups | stale leads, sync failures, consent gaps | customer proposal and account summary | sales pipeline |
| Finance user | invoices, payments, refunds, price/discount usage | reconciliation, failed payments, tax-rule exceptions | invoice, receipt, tax and account statements | finance and revenue |
| HR/manager | organization, employee, attendance, performance, training | access anomalies, missing compliance, capacity | employee statements and compliance extracts | workforce dashboard |
| Service provider | assigned tenants, delivery SLA, open work, billable activity | API quota, credential health, incident status | tenant service-delivery report | multi-tenant provider console |
| Customer B2B | contract usage, enrolled employees, engagement | entitlement and service availability | invoices, utilization and outcome report | customer organization portal |
| Customer B2C | purchases, bookings, progress, rewards | account security, consent and notification status | receipt, personal progress and data export | personal customer dashboard |
| Employee B2E | assigned work, attendance, goals, learning | access/session and task health | payslip or employment document where integrated | employee self-service |
| Auditor/compliance | immutable audit events, access and consent history | control failures, retention, data lineage | compliance evidence pack | read-only assurance dashboard |
| Developer/operations | deployments, API usage, schema migrations, incidents | logs, traces, metrics, SLO, dead-letter, resource utilization | API status/SLA report | engineering observability |

## Shared report registry

Store report definitions separately from executions and deliveries:

- `report_definition`: tenant visibility, owner, audience, data source, filters, version.
- `report_schedule`: cadence, timezone, recipients, approval policy.
- `report_run`: request, status, start/end, row count, checksum, error.
- `report_artifact`: immutable generated file and retention classification.
- `report_delivery`: internal/external destination, delivery status, retry data.
- `dashboard_definition`: stakeholder role, widgets, layout and feature flags.
- `dashboard_widget`: metric/query reference, refresh interval and access policy.

Never create separate copies of organization, product, tax, price or discount masters for every module. Use shared tenant-scoped masters and module-owned transaction tables with foreign keys.
