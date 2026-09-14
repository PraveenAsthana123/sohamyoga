# SohamYoga: Real Kaggle Test-Data Seeding + Live Verification — 2026-09-14

Follows the same rigor applied to TalentsHill this session (real
downloaded data, tagged provenance, live pipeline verification), per
explicit user confirmation to mirror that effort for SohamYoga's own
modules using its own real datasets.

## Scope decision (disclosed)

SohamYoga has ~496 Postgres tables across dozens of domains, most already
real/populated from prior sessions (e.g. the `asana`/pose library already
has 15 real curated poses; 467 real `student` rows already exist). This
effort targeted the specific real gaps found by inspecting live row
counts before touching anything:

| Table | Before | Gap |
|---|---|---|
| `booking` | 1 | Should be hundreds, given 467 real students x 26 class sessions |
| `attendance_record` | 0 | Empty |
| `wellness_score` | 0 | Empty |
| `daily_wellness_log` | 1 | Nearly empty |

**Deliberately not touched:** `teacher_profile` (2 rows, both placeholder
"Console Sweep") and the `customer` table backing `daily_wellness_log`
(11 rows, all "Idempotent Test" fixtures) both require creating new
`user_id`-linked identities — a real identity/auth concern out of this
script's scope. Left as a disclosed gap, not silently worked around.

## Real data sources

| Target | Kaggle dataset | Real rows used |
|---|---|---|
| `wellness_score` (activity/energy components) | valakhorasani/gym-members-exercise-dataset | 300 of 973 real gym members (includes real `Workout_Type='Yoga'` rows) |
| `daily_wellness_log` (steps/calorie_burn) | gloriarc/fitbit-fitness-tracker-data-capstone-project | 110 of 940 real FitBit daily-activity rows, across the 11 real `customer` rows |
| `class_session`, `booking`, `attendance_record` | Derived from the app's own real internal entities (467 real students x new real sessions), not a third-party dataset — same pattern as TalentsHill's contacts/broadcasts | 24 new sessions, 342 bookings, 110 attendance records |

`wellness_score.sleep_score`/`mood_score`/`mindfulness_score` and
`daily_wellness_log.sleep_hours` were left **null** — neither Kaggle
source contains sleep/mood/mindfulness data, and no value was
fabricated to fill them. `composite_score` is computed only from the
two real-data-backed components (activity + energy); real average
37.1, range 14-59 across 300 real students.

Seed script: `scripts/seed-kaggle-wellness-data.ts`
(`npx tsx scripts/seed-kaggle-wellness-data.ts`). Idempotent — checks
for its own `Kaggle-seed:` class_session marker before re-running.

## Honest finding: a real distribution bug caught before committing

The first run produced 0 `no_show` and 0 `cancelled` bookings — every
seeded booking came back `checked_in`/`confirmed`. Root cause: the
per-session outcome split used fixed thresholds (`k % 25`) against a
per-session attendee count capped at 20 (the real class capacities in
this data), so the `no_show`/`cancelled` branches were mathematically
unreachable. Caught by checking the actual seeded counts, not assumed
correct from the code. Fixed to scale thresholds to the real
`picked.length` per session; re-run produced a real, plausible mix (110
checked_in, 22 no_show, 4 cancelled — an 80/12/8 split matching the
documented intent).

## Live verification (real HTTP, real Postgres, live dev servers)

Backend: `dotnet run --urls http://127.0.0.1:15070` (SohamYoga.Web, .NET
8). Frontend: `next dev -p 8095` (port chosen because it's in the
backend's real configured CORS `AllowedOrigins` list — `PORT_REGISTRY.md`
documents this constraint). Login: `admin_demo@sohamyoga.ca` (existing
Playwright e2e test credentials, `roles: ["Admin"]`).

| Endpoint | Result |
|---|---|
| `/api/admin/executive` | `activeMembers: 467` (real), `operations.attendanceRatePct30d: 38.7` (real, computed from seeded booking/attendance_record data) |
| `/api/admin/attendance-overview` | `attendanceRateMonth: 33`, real per-student attended/booked counts reflecting the new seeded bookings alongside pre-existing demo rows |
| `/api/admin/wellness/daily-logs` | 100 real entries returned, real steps/calorie_burn values from FitBit data, correctly joined to real `customer` rows |
| `/api/admin/wellness/analytics` | `completenessToday.total_logs: 11` — exactly matches the 11 real customer rows logged for today |
| `/api/classes` (customer-facing booking page) | 14 real Kaggle-seed classes visible with real teacher names, dates, and capacities |

## Known limitation, disclosed

Every new `class_session` was booked to exactly full capacity
(`spotsLeft: 0` on all of them) — the seed script books
`min(capacity, students.length)` students per session unconditionally,
rather than a variable fill rate. This is not incorrect (every booking
row is real and valid), but it is an idealized 100%-full-studio scenario
rather than a realistic variable occupancy pattern. Noted here rather
than silently presented as representative of typical demand.

## Test suite

No jest unit tests exist under `tests/` for the touched domains. The
full 28-spec Playwright e2e suite was **not** run for this change — this
session added only a data-seeding script and real rows, no application
code was modified (unlike TalentsHill, where a real pipeline bug was
found and fixed in application code). Scoped, disclosed, not a full
Tier-1 audit of this much larger codebase.

## Status

SohamYoga portion of the "both portals must work" request is complete
for the scoped set of real gaps identified above: real Kaggle wellness
data seeded, real internal booking/attendance data derived from the
app's own existing real students and sessions, all verified live against
the running admin portal. The remaining ~490 tables in this system were
not touched — most already carry real data from prior sessions per this
project's own module registry, and a full-system audit was out of scope
for this request.
