-- Migration: Initial Schema
-- Created: 2024-12-16

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- 1. USERS (For Authentication)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. FOLDERS (Supports Nested Folders)
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  project_name TEXT DEFAULT 'Default'
);

CREATE INDEX IF NOT EXISTS parent_id_idx ON folders(parent_id);

-- 3. TEST CASES (The Repository)
CREATE TABLE IF NOT EXISTS test_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  pre_conditions TEXT,
  priority TEXT CHECK(priority IN ('High', 'Medium', 'Low')),
  status TEXT DEFAULT 'Draft',
  is_automated INTEGER DEFAULT 0,
  folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  author_id INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS folder_id_idx ON test_cases(folder_id);
CREATE INDEX IF NOT EXISTS author_id_idx ON test_cases(author_id);

-- 4. TEST CASE STEPS (Multiple steps per case)
CREATE TABLE IF NOT EXISTS test_case_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  expected_result TEXT
);

CREATE INDEX IF NOT EXISTS test_case_id_idx ON test_case_steps(test_case_id);

-- 5. TAGS (For filtering)
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- Junction table to link Tags to Cases
CREATE TABLE IF NOT EXISTS test_case_tags (
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (test_case_id, tag_id)
);

CREATE INDEX IF NOT EXISTS tc_tag_test_case_id_idx ON test_case_tags(test_case_id);
CREATE INDEX IF NOT EXISTS tc_tag_tag_id_idx ON test_case_tags(tag_id);

-- 6. TEST SUITES (The Container for a Test Run)
CREATE TABLE IF NOT EXISTS test_suites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'In Progress',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS suite_created_by_idx ON test_suites(created_by);

-- 7. TEST RUN ENTRIES (A specific instance of a test case in a suite)
CREATE TABLE IF NOT EXISTS test_run_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_suite_id INTEGER NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  test_case_id INTEGER NOT NULL REFERENCES test_cases(id),
  status TEXT DEFAULT 'Not Run',
  actual_result TEXT,
  assigned_to INTEGER REFERENCES users(id),
  executed_at TEXT
);

CREATE INDEX IF NOT EXISTS run_test_suite_id_idx ON test_run_entries(test_suite_id);
CREATE INDEX IF NOT EXISTS run_test_case_id_idx ON test_run_entries(test_case_id);

-- 8. TEST RUN STEP RESULTS (Status for individual steps in a run)
CREATE TABLE IF NOT EXISTS test_run_step_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_run_entry_id INTEGER NOT NULL REFERENCES test_run_entries(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  action TEXT,
  expected_result TEXT,
  actual_result TEXT,
  status TEXT DEFAULT 'Not Run'
);

CREATE INDEX IF NOT EXISTS step_test_run_entry_id_idx ON test_run_step_results(test_run_entry_id);

