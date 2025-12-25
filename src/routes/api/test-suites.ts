import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Bindings } from '../../types';
import { createDb } from '../../db';
import { testSuites, testRunEntries, testCases, testCaseSteps, testRunStepResults, users } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { authMiddleware, requireAuth } from '../../middleware/auth';
import { setCacheHeaders, CacheTTL } from '../../middleware/cache';

const testSuitesRoutes = new Hono<{ Bindings: Bindings }>();

// Apply middleware
testSuitesRoutes.use('*', authMiddleware);

// Create test suite schema
const createTestSuiteSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  testCaseIds: z.array(z.number()).min(1, 'At least one test case is required'),
});

// GET /api/test-suites - Get all test suites
testSuitesRoutes.get('/', async (c) => {
  const db = createDb(c.env.DB);
  
  try {
    const suites = await db
      .select({
        suite: testSuites,
        creator: users,
      })
      .from(testSuites)
      .leftJoin(users, eq(testSuites.createdBy, users.id))
      .orderBy(sql`${testSuites.createdAt} DESC`);
    
    // Get stats for each suite
    const suitesWithStats = await Promise.all(
      suites.map(async ({ suite, creator }) => {
        const stats = await db
          .select({
            status: testRunEntries.status,
            count: sql<number>`count(*)`,
          })
          .from(testRunEntries)
          .where(eq(testRunEntries.testSuiteId, suite.id))
          .groupBy(testRunEntries.status);
        
        const total = stats.reduce((sum, s) => sum + Number(s.count), 0);
        const passed = stats.find(s => s.status === 'Passed')?.count || 0;
        const failed = stats.find(s => s.status === 'Failed')?.count || 0;
        const blocked = stats.find(s => s.status === 'Blocked')?.count || 0;
        const notRun = stats.find(s => s.status === 'Not Run')?.count || 0;
        
        return {
          ...suite,
          creator: creator ? { id: creator.id, fullName: creator.fullName, email: creator.email } : null,
          stats: {
            total,
            passed: Number(passed),
            failed: Number(failed),
            blocked: Number(blocked),
            notRun: Number(notRun),
          },
        };
      })
    );
    
    // Set cache headers for edge caching (2 min cache)
    setCacheHeaders(c, CacheTTL.LIST_API, { 
      staleWhileRevalidate: CacheTTL.LIST_API 
    });
    
    return c.json(suitesWithStats);
  } catch (error) {
    console.error('Get test suites error:', error);
    return c.json({ error: 'Failed to fetch test suites' }, 500);
  }
});

// GET /api/test-suites/:id - Get test suite by ID with entries
testSuitesRoutes.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const db = createDb(c.env.DB);
  
  try {
    const [suite] = await db
      .select({
        suite: testSuites,
        creator: users,
      })
      .from(testSuites)
      .leftJoin(users, eq(testSuites.createdBy, users.id))
      .where(eq(testSuites.id, id))
      .limit(1);
    
    if (!suite) {
      return c.json({ error: 'Test suite not found' }, 404);
    }
    
    // Get entries with test case details
    const entries = await db
      .select({
        entry: testRunEntries,
        testCase: testCases,
        assignee: users,
      })
      .from(testRunEntries)
      .leftJoin(testCases, eq(testRunEntries.testCaseId, testCases.id))
      .leftJoin(users, eq(testRunEntries.assignedTo, users.id))
      .where(eq(testRunEntries.testSuiteId, id));
    
    // Get stats
    const stats = await db
      .select({
        status: testRunEntries.status,
        count: sql<number>`count(*)`,
      })
      .from(testRunEntries)
      .where(eq(testRunEntries.testSuiteId, id))
      .groupBy(testRunEntries.status);
    
    const total = stats.reduce((sum, s) => sum + Number(s.count), 0);
    const passed = stats.find(s => s.status === 'Passed')?.count || 0;
    const failed = stats.find(s => s.status === 'Failed')?.count || 0;
    const blocked = stats.find(s => s.status === 'Blocked')?.count || 0;
    const notRun = stats.find(s => s.status === 'Not Run')?.count || 0;
    
    return c.json({
      ...suite.suite,
      creator: suite.creator ? { 
        id: suite.creator.id, 
        fullName: suite.creator.fullName, 
        email: suite.creator.email 
      } : null,
      entries: entries.map(({ entry, testCase, assignee }) => ({
        ...entry,
        testCase,
        assignee: assignee ? { 
          id: assignee.id, 
          fullName: assignee.fullName, 
          email: assignee.email 
        } : null,
      })),
      stats: {
        total,
        passed: Number(passed),
        failed: Number(failed),
        blocked: Number(blocked),
        notRun: Number(notRun),
      },
    });
  } catch (error) {
    console.error('Get test suite error:', error);
    return c.json({ error: 'Failed to fetch test suite' }, 500);
  }
});

// POST /api/test-suites - Create test suite
testSuitesRoutes.post('/', requireAuth, zValidator('json', createTestSuiteSchema), async (c) => {
  const { title, description, testCaseIds } = c.req.valid('json');
  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  
  try {
    // Create test suite
    const [newSuite] = await db
      .insert(testSuites)
      .values({
        title,
        description: description || null,
        status: 'In Progress',
        createdBy: user.id,
      })
      .returning();
    
    // Create test run entries with step snapshots
    for (const testCaseId of testCaseIds) {
      // Create entry
      const [entry] = await db
        .insert(testRunEntries)
        .values({
          testSuiteId: newSuite.id,
          testCaseId,
          status: 'Not Run',
          assignedTo: user.id,
        })
        .returning();
      
      // Get test case steps and create step results
      const steps = await db
        .select()
        .from(testCaseSteps)
        .where(eq(testCaseSteps.testCaseId, testCaseId))
        .orderBy(testCaseSteps.stepNumber);
      
      if (steps.length > 0) {
        await db.insert(testRunStepResults).values(
          steps.map(step => ({
            testRunEntryId: entry.id,
            stepNumber: step.stepNumber,
            action: step.action,
            expectedResult: step.expectedResult,
            status: 'Not Run',
          }))
        );
      }
    }
    
    return c.json(newSuite, 201);
  } catch (error) {
    console.error('Create test suite error:', error);
    return c.json({ error: 'Failed to create test suite' }, 500);
  }
});

// PUT /api/test-suites/:id - Update test suite status
testSuitesRoutes.put('/:id', requireAuth, async (c) => {
  const id = parseInt(c.req.param('id'));
  const db = createDb(c.env.DB);
  
  try {
    const body = await c.req.json();
    const { status } = body;
    
    const [updatedSuite] = await db
      .update(testSuites)
      .set({ status })
      .where(eq(testSuites.id, id))
      .returning();
    
    if (!updatedSuite) {
      return c.json({ error: 'Test suite not found' }, 404);
    }
    
    return c.json(updatedSuite);
  } catch (error) {
    console.error('Update test suite error:', error);
    return c.json({ error: 'Failed to update test suite' }, 500);
  }
});

// DELETE /api/test-suites/:id - Delete test suite
testSuitesRoutes.delete('/:id', requireAuth, async (c) => {
  const id = parseInt(c.req.param('id'));
  const db = createDb(c.env.DB);
  
  try {
    const [deletedSuite] = await db
      .delete(testSuites)
      .where(eq(testSuites.id, id))
      .returning();
    
    if (!deletedSuite) {
      return c.json({ error: 'Test suite not found' }, 404);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete test suite error:', error);
    return c.json({ error: 'Failed to delete test suite' }, 500);
  }
});

export { testSuitesRoutes };

