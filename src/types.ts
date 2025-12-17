import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

export type Bindings = {
  DB: D1Database;
  SESSIONS: KVNamespace;
  JWT_SECRET: string;
};

export interface User {
  id: number;
  email: string;
  fullName: string | null;
}

export interface JWTPayload {
  sub: string;
  email: string;
  name: string | null;
  exp: number;
  iat: number;
}

export interface Folder {
  id: number;
  name: string;
  parentId: number | null;
  projectName: string | null;
}

export interface TestCase {
  id: number;
  title: string;
  description: string | null;
  preConditions: string | null;
  priority: string | null;
  status: string | null;
  isAutomated: boolean;
  folderId: number | null;
  authorId: number | null;
  createdAt: string | null;
}

export interface TestCaseStep {
  id: number;
  testCaseId: number;
  stepNumber: number;
  action: string;
  expectedResult: string | null;
}

export interface Tag {
  id: number;
  name: string;
}

export interface TestSuite {
  id: number;
  title: string;
  description: string | null;
  status: string | null;
  createdBy: number | null;
  createdAt: string | null;
}

export interface TestRunEntry {
  id: number;
  testSuiteId: number;
  testCaseId: number;
  status: string | null;
  actualResult: string | null;
  assignedTo: number | null;
  executedAt: string | null;
}

export interface TestRunStepResult {
  id: number;
  testRunEntryId: number;
  stepNumber: number;
  action: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  status: string | null;
}

export interface DashboardStats {
  statusDistribution: Array<{ status: string; count: number }>;
  executionTrend: Array<{ date: string; count: number }>;
  summary: {
    totalTestCases: number;
    totalTestSuites: number;
    totalTestRuns: number;
  };
}

