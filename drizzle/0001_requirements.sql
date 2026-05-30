-- Migration: Add Requirements Tables
-- Created: 2026-05-30

-- 9. REQUIREMENTS (User Stories / Requirements)
CREATE TABLE IF NOT EXISTS requirements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  req_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'Open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Junction table to handle many-to-many relationship between Test Cases and Requirements
CREATE TABLE IF NOT EXISTS test_case_requirements (
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  requirement_id INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  PRIMARY KEY (test_case_id, requirement_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS tc_req_unique_idx ON test_case_requirements(test_case_id, requirement_id);
