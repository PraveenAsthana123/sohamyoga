-- Deep testing job (real Playwright e2e suite, scheduled + tracked).
--
-- Named playwright_suite_run / playwright_test_result rather than the more
-- obvious module_test_run / module_test_case_result -- those names were
-- already taken by a pre-existing, unrelated system (112 real rows as of
-- 2026-09-08, test_type='ui_http', module_id -> module_master, a THIRD
-- registry distinct from module_registry) that does lightweight synthetic
-- route-uptime pings, not real browser e2e tests. Caught before collision:
-- an accidental FK into the wrong table was found and dropped before any
-- real data existed. Left that system untouched.
--
-- Complements module_boundary_report (Ollama static-review of source) with
-- an actual DYNAMIC test run: real Playwright browser automation against
-- the running app, real pass/fail per test case, and an Ollama advisory
-- pass over any failures -- the §166 "test" step this repo did not yet
-- have at the whole-suite level (only npm test/build ran on a schedule
-- before this, per scripts/run-platform-quality-gates.sh).
CREATE TABLE IF NOT EXISTS playwright_suite_run (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at      TIMESTAMPTZ  NOT NULL,
  finished_at     TIMESTAMPTZ,
  triggered_by    VARCHAR(20)  NOT NULL DEFAULT 'scheduled' CHECK (triggered_by IN ('scheduled','manual')),
  git_commit      VARCHAR(40),
  total_tests     INTEGER      NOT NULL DEFAULT 0,
  passed          INTEGER      NOT NULL DEFAULT 0,
  failed          INTEGER      NOT NULL DEFAULT 0,
  skipped         INTEGER      NOT NULL DEFAULT 0,
  status          VARCHAR(20)  NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','crashed')),
  crash_reason    TEXT,
  advisory_text   TEXT,
  advisory_generated_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS playwright_test_result (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_run_id    UUID         NOT NULL REFERENCES playwright_suite_run(id) ON DELETE CASCADE,
  spec_file       VARCHAR(200) NOT NULL,
  module_keys     TEXT[]       NOT NULL DEFAULT '{}',
  test_title      TEXT         NOT NULL,
  status          VARCHAR(20)  NOT NULL CHECK (status IN ('passed','failed','skipped','timedOut')),
  duration_ms     INTEGER      NOT NULL DEFAULT 0,
  error_message   TEXT,
  retries         INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pw_test_result_run ON playwright_test_result(suite_run_id);
CREATE INDEX IF NOT EXISTS idx_pw_test_result_modules ON playwright_test_result USING GIN(module_keys);
CREATE INDEX IF NOT EXISTS idx_pw_suite_run_started ON playwright_suite_run(started_at DESC);

-- Which module_registry.module_key each spec file covers -- hand-maintained
-- (test files don't 1:1 map to modules; several cover multiple modules),
-- rather than guessed at parse time. A spec file with no row here is
-- honestly "uncatalogued", not silently attributed to the wrong module.
CREATE TABLE IF NOT EXISTS playwright_spec_module_map (
  spec_file    VARCHAR(200) PRIMARY KEY,
  module_keys  TEXT[]       NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE playwright_suite_run IS
  'One row per scheduled or manual Playwright e2e suite run. status=crashed means the run itself failed to complete (e.g. dev server down), distinct from failed individual test cases.';
COMMENT ON TABLE playwright_test_result IS
  'One row per individual Playwright test case in a run, attributed to module_registry.module_key(s) via playwright_spec_module_map.';
