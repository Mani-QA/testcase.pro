import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Bindings } from '../../types';
import { createDb } from '../../db';
import { testRunEntries, testCases, testCaseSteps, testRunStepResults } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware, requireAuth } from '../../middleware/auth';
import { setCacheHeaders, CacheTTL } from '../../middleware/cache';

const testRunsRoutes = new Hono<{ Bindings: Bindings }>();

// Apply middleware
testRunsRoutes.use('*', authMiddleware);

// Update test run entry schema
const updateTestRunSchema = z.object({
  status: z.string(),
  actualResult: z.string().nullable().optional(),
  stepResults: z.array(z.object({
    stepNumber: z.number(),
    action: z.string().nullable().optional(),
    expectedResult: z.string().nullable().optional(),
    actualResult: z.string().nullable().optional(),
    status: z.string(),
  })).optional(),
});

// GET /api/test-runs/:id - Get test run entry by ID
testRunsRoutes.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const db = createDb(c.env.DB);
  
  try {
    const [entry] = await db
      .select({
        entry: testRunEntries,
        testCase: testCases,
      })
      .from(testRunEntries)
      .leftJoin(testCases, eq(testRunEntries.testCaseId, testCases.id))
      .where(eq(testRunEntries.id, id))
      .limit(1);
    
    if (!entry) {
      return c.json({ error: 'Test run entry not found' }, 404);
    }
    
    // Get test case steps
    const steps = await db
      .select()
      .from(testCaseSteps)
      .where(eq(testCaseSteps.testCaseId, entry.entry.testCaseId))
      .orderBy(testCaseSteps.stepNumber);
    
    // Get step results if they exist
    const stepResults = await db
      .select()
      .from(testRunStepResults)
      .where(eq(testRunStepResults.testRunEntryId, id))
      .orderBy(testRunStepResults.stepNumber);
    
    // Set cache headers for edge caching (1 min cache for run details)
    setCacheHeaders(c, CacheTTL.ITEM_API, { 
      staleWhileRevalidate: CacheTTL.ITEM_API 
    });
    
    return c.json({
      ...entry.entry,
      testCase: entry.testCase,
      steps,
      stepResults,
    });
  } catch (error) {
    console.error('Get test run entry error:', error);
    return c.json({ error: 'Failed to fetch test run entry' }, 500);
  }
});

// PUT /api/test-runs/:id - Update test run entry
testRunsRoutes.put('/:id', requireAuth, zValidator('json', updateTestRunSchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  const { status, actualResult, stepResults } = c.req.valid('json');
  const db = createDb(c.env.DB);
  
  try {
    // Update test run entry
    const [updatedEntry] = await db
      .update(testRunEntries)
      .set({
        status,
        actualResult: actualResult || null,
        executedAt: new Date().toISOString(),
      })
      .where(eq(testRunEntries.id, id))
      .returning();
    
    if (!updatedEntry) {
      return c.json({ error: 'Test run entry not found' }, 404);
    }
    
    // Update or create step results
    if (stepResults && stepResults.length > 0) {
      // Delete existing step results
      await db.delete(testRunStepResults).where(eq(testRunStepResults.testRunEntryId, id));
      
      // Insert new step results
      await db.insert(testRunStepResults).values(
        stepResults.map((step) => ({
          testRunEntryId: id,
          stepNumber: step.stepNumber,
          action: step.action || null,
          expectedResult: step.expectedResult || null,
          actualResult: step.actualResult || null,
          status: step.status,
        }))
      );
    }
    
    return c.json(updatedEntry);
  } catch (error) {
    console.error('Update test run entry error:', error);
    return c.json({ error: 'Failed to update test run entry' }, 500);
  }
});

export { testRunsRoutes };

