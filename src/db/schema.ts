import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// 1. USERS (For Authentication)
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// 2. FOLDERS (Supports Nested Folders)
export const folders = sqliteTable('folders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  parentId: integer('parent_id').references((): any => folders.id, { onDelete: 'cascade' }),
  projectName: text('project_name').default('Default'),
}, (table) => ({
  parentIdIdx: index('parent_id_idx').on(table.parentId),
}));

// 3. TEST CASES (The Repository)
export const testCases = sqliteTable('test_cases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  preConditions: text('pre_conditions'),
  priority: text('priority', { enum: ['High', 'Medium', 'Low'] }),
  status: text('status').default('Draft'),
  isAutomated: integer('is_automated', { mode: 'boolean' }).default(false),
  folderId: integer('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  authorId: integer('author_id').references(() => users.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  folderIdIdx: index('folder_id_idx').on(table.folderId),
  authorIdIdx: index('author_id_idx').on(table.authorId),
}));

// 4. TEST CASE STEPS (Multiple steps per case)
export const testCaseSteps = sqliteTable('test_case_steps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  testCaseId: integer('test_case_id').notNull().references(() => testCases.id, { onDelete: 'cascade' }),
  stepNumber: integer('step_number').notNull(),
  action: text('action').notNull(),
  expectedResult: text('expected_result'),
}, (table) => ({
  testCaseIdIdx: index('test_case_id_idx').on(table.testCaseId),
}));

// 5. TAGS (For filtering)
export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
});

// Junction table to link Tags to Cases
export const testCaseTags = sqliteTable('test_case_tags', {
  testCaseId: integer('test_case_id').notNull().references(() => testCases.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  testCaseIdIdx: index('tc_tag_test_case_id_idx').on(table.testCaseId),
  tagIdIdx: index('tc_tag_tag_id_idx').on(table.tagId),
}));

// 6. TEST SUITES (The Container for a Test Run)
export const testSuites = sqliteTable('test_suites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('In Progress'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  createdByIdx: index('suite_created_by_idx').on(table.createdBy),
}));

// 7. TEST RUN ENTRIES (A specific instance of a test case in a suite)
export const testRunEntries = sqliteTable('test_run_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  testSuiteId: integer('test_suite_id').notNull().references(() => testSuites.id, { onDelete: 'cascade' }),
  testCaseId: integer('test_case_id').notNull().references(() => testCases.id),
  status: text('status').default('Not Run'),
  actualResult: text('actual_result'),
  assignedTo: integer('assigned_to').references(() => users.id),
  executedAt: text('executed_at'),
}, (table) => ({
  testSuiteIdIdx: index('run_test_suite_id_idx').on(table.testSuiteId),
  testCaseIdIdx: index('run_test_case_id_idx').on(table.testCaseId),
}));

// 8. TEST RUN STEP RESULTS (Status for individual steps in a run)
export const testRunStepResults = sqliteTable('test_run_step_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  testRunEntryId: integer('test_run_entry_id').notNull().references(() => testRunEntries.id, { onDelete: 'cascade' }),
  stepNumber: integer('step_number').notNull(),
  action: text('action'),
  expectedResult: text('expected_result'),
  actualResult: text('actual_result'),
  status: text('status').default('Not Run'),
}, (table) => ({
  testRunEntryIdIdx: index('step_test_run_entry_id_idx').on(table.testRunEntryId),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  testCases: many(testCases),
  testSuites: many(testSuites),
  assignedTestRuns: many(testRunEntries),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
  }),
  children: many(folders),
  testCases: many(testCases),
}));

export const testCasesRelations = relations(testCases, ({ one, many }) => ({
  folder: one(folders, {
    fields: [testCases.folderId],
    references: [folders.id],
  }),
  author: one(users, {
    fields: [testCases.authorId],
    references: [users.id],
  }),
  steps: many(testCaseSteps),
  tags: many(testCaseTags),
  testRunEntries: many(testRunEntries),
}));

export const testCaseStepsRelations = relations(testCaseSteps, ({ one }) => ({
  testCase: one(testCases, {
    fields: [testCaseSteps.testCaseId],
    references: [testCases.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  testCases: many(testCaseTags),
}));

export const testCaseTagsRelations = relations(testCaseTags, ({ one }) => ({
  testCase: one(testCases, {
    fields: [testCaseTags.testCaseId],
    references: [testCases.id],
  }),
  tag: one(tags, {
    fields: [testCaseTags.tagId],
    references: [tags.id],
  }),
}));

export const testSuitesRelations = relations(testSuites, ({ one, many }) => ({
  creator: one(users, {
    fields: [testSuites.createdBy],
    references: [users.id],
  }),
  entries: many(testRunEntries),
}));

export const testRunEntriesRelations = relations(testRunEntries, ({ one, many }) => ({
  testSuite: one(testSuites, {
    fields: [testRunEntries.testSuiteId],
    references: [testSuites.id],
  }),
  testCase: one(testCases, {
    fields: [testRunEntries.testCaseId],
    references: [testCases.id],
  }),
  assignee: one(users, {
    fields: [testRunEntries.assignedTo],
    references: [users.id],
  }),
  stepResults: many(testRunStepResults),
}));

export const testRunStepResultsRelations = relations(testRunStepResults, ({ one }) => ({
  testRunEntry: one(testRunEntries, {
    fields: [testRunStepResults.testRunEntryId],
    references: [testRunEntries.id],
  }),
}));

