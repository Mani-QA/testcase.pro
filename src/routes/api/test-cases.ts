import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Bindings } from '../../types';
import { createDb } from '../../db';
import { testCases, testCaseSteps, testCaseTags, tags, users, folders } from '../../db/schema';
import { eq, and, inArray, isNull, sql } from 'drizzle-orm';
import { authMiddleware, requireAuthForMutations, requireAuth } from '../../middleware/auth';
import Papa from 'papaparse';
import { generateTestCaseId } from '../../lib/utils';

const testCasesRoutes = new Hono<{ Bindings: Bindings }>();

// Apply middleware
testCasesRoutes.use('*', authMiddleware);

// Create test case schema
const createTestCaseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  preConditions: z.string().nullable().optional(),
  priority: z.enum(['High', 'Medium', 'Low']).optional(),
  status: z.string().optional(),
  isAutomated: z.boolean().optional(),
  folderId: z.number().nullable().optional(),
  steps: z.array(z.object({
    action: z.string(),
    expectedResult: z.string().nullable().optional(),
  })).optional(),
  tags: z.array(z.string()).optional(),
});

// Bulk delete schema
const bulkDeleteSchema = z.object({
  testCaseIds: z.array(z.number()),
});

// GET /api/test-cases - Get all test cases
testCasesRoutes.get('/', async (c) => {
  const db = createDb(c.env.DB);
  const folderId = c.req.query('folderId');
  
  try {
    let query = db
      .select({
        testCase: testCases,
        author: users,
      })
      .from(testCases)
      .leftJoin(users, eq(testCases.authorId, users.id));
    
    if (folderId) {
      query = query.where(eq(testCases.folderId, parseInt(folderId))) as any;
    }
    
    const results = await query;
    
    // Get steps and tags for each test case
    const testCasesWithDetails = await Promise.all(
      results.map(async ({ testCase, author }) => {
        const steps = await db
          .select()
          .from(testCaseSteps)
          .where(eq(testCaseSteps.testCaseId, testCase.id))
          .orderBy(testCaseSteps.stepNumber);
        
        const caseTags = await db
          .select({ tag: tags })
          .from(testCaseTags)
          .leftJoin(tags, eq(testCaseTags.tagId, tags.id))
          .where(eq(testCaseTags.testCaseId, testCase.id));
        
        return {
          ...testCase,
          steps,
          tags: caseTags.map(ct => ct.tag).filter(Boolean),
          author: author ? { id: author.id, fullName: author.fullName, email: author.email } : null,
        };
      })
    );
    
    return c.json(testCasesWithDetails);
  } catch (error) {
    console.error('Get test cases error:', error);
    return c.json({ error: 'Failed to fetch test cases' }, 500);
  }
});

// GET /api/test-cases/export - Export test cases as CSV
testCasesRoutes.get('/export', async (c) => {
  const db = createDb(c.env.DB);
  const folderId = c.req.query('folderId');
  const priorityFilter = c.req.query('priority');
  const statusFilter = c.req.query('status');
  const automatedFilter = c.req.query('automated');
  
  try {
    let results = await db
      .select({
        testCase: testCases,
        folder: folders,
      })
      .from(testCases)
      .leftJoin(folders, eq(testCases.folderId, folders.id));
    
    // Apply filters
    if (folderId) {
      results = results.filter(r => r.testCase.folderId === parseInt(folderId));
    }
    if (priorityFilter) {
      results = results.filter(r => r.testCase.priority === priorityFilter);
    }
    if (statusFilter) {
      results = results.filter(r => r.testCase.status === statusFilter);
    }
    if (automatedFilter) {
      const isAutomated = automatedFilter === 'true';
      results = results.filter(r => r.testCase.isAutomated === isAutomated);
    }
    
    // Build CSV data with steps expanded
    const csvRows: any[] = [];
    
    for (const { testCase, folder } of results) {
      const steps = await db
        .select()
        .from(testCaseSteps)
        .where(eq(testCaseSteps.testCaseId, testCase.id))
        .orderBy(testCaseSteps.stepNumber);
      
      const caseTags = await db
        .select({ tag: tags })
        .from(testCaseTags)
        .leftJoin(tags, eq(testCaseTags.tagId, tags.id))
        .where(eq(testCaseTags.testCaseId, testCase.id));
      
      const tagNames = caseTags.map(ct => ct.tag?.name).filter(Boolean).join(', ');
      
      if (steps.length === 0) {
        csvRows.push({
          ID: generateTestCaseId(testCase.id),
          Title: testCase.title,
          Description: testCase.description || '',
          Preconditions: testCase.preConditions || '',
          Priority: testCase.priority || 'Medium',
          Status: testCase.status || 'Draft',
          Automated: testCase.isAutomated ? 'Yes' : 'No',
          Location: folder?.name || '',
          Tags: tagNames,
          StepNumber: '',
          StepAction: '',
          ExpectedResult: '',
        });
      } else {
        steps.forEach((step, index) => {
          csvRows.push({
            ID: index === 0 ? generateTestCaseId(testCase.id) : '',
            Title: index === 0 ? testCase.title : '',
            Description: index === 0 ? testCase.description || '' : '',
            Preconditions: index === 0 ? testCase.preConditions || '' : '',
            Priority: index === 0 ? testCase.priority || 'Medium' : '',
            Status: index === 0 ? testCase.status || 'Draft' : '',
            Automated: index === 0 ? (testCase.isAutomated ? 'Yes' : 'No') : '',
            Location: index === 0 ? folder?.name || '' : '',
            Tags: index === 0 ? tagNames : '',
            StepNumber: step.stepNumber,
            StepAction: step.action,
            ExpectedResult: step.expectedResult || '',
          });
        });
      }
    }
    
    const csv = Papa.unparse(csvRows);
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="test-cases-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return c.json({ error: 'Failed to export test cases' }, 500);
  }
});

// GET /api/test-cases/:id - Get test case by ID
testCasesRoutes.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const db = createDb(c.env.DB);
  
  try {
    const [result] = await db
      .select({
        testCase: testCases,
        author: users,
      })
      .from(testCases)
      .leftJoin(users, eq(testCases.authorId, users.id))
      .where(eq(testCases.id, id))
      .limit(1);
    
    if (!result) {
      return c.json({ error: 'Test case not found' }, 404);
    }
    
    const steps = await db
      .select()
      .from(testCaseSteps)
      .where(eq(testCaseSteps.testCaseId, id))
      .orderBy(testCaseSteps.stepNumber);
    
    const caseTags = await db
      .select({ tag: tags })
      .from(testCaseTags)
      .leftJoin(tags, eq(testCaseTags.tagId, tags.id))
      .where(eq(testCaseTags.testCaseId, id));
    
    return c.json({
      ...result.testCase,
      steps,
      tags: caseTags.map(ct => ct.tag).filter(Boolean),
      author: result.author ? { 
        id: result.author.id, 
        fullName: result.author.fullName, 
        email: result.author.email 
      } : null,
    });
  } catch (error) {
    console.error('Get test case error:', error);
    return c.json({ error: 'Failed to fetch test case' }, 500);
  }
});

// POST /api/test-cases - Create test case
testCasesRoutes.post('/', requireAuth, zValidator('json', createTestCaseSchema), async (c) => {
  const data = c.req.valid('json');
  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  
  try {
    // Create test case
    const [newTestCase] = await db
      .insert(testCases)
      .values({
        title: data.title,
        description: data.description || null,
        preConditions: data.preConditions || null,
        priority: data.priority || 'Medium',
        status: data.status || 'Draft',
        isAutomated: data.isAutomated || false,
        folderId: data.folderId || null,
        authorId: user.id,
      })
      .returning();
    
    // Create steps
    if (data.steps && data.steps.length > 0) {
      await db.insert(testCaseSteps).values(
        data.steps.map((step, index) => ({
          testCaseId: newTestCase.id,
          stepNumber: index + 1,
          action: step.action,
          expectedResult: step.expectedResult || null,
        }))
      );
    }
    
    // Handle tags
    if (data.tags && data.tags.length > 0) {
      for (const tagName of data.tags) {
        let [tag] = await db.select().from(tags).where(eq(tags.name, tagName)).limit(1);
        
        if (!tag) {
          [tag] = await db.insert(tags).values({ name: tagName }).returning();
        }
        
        await db.insert(testCaseTags).values({
          testCaseId: newTestCase.id,
          tagId: tag.id,
        });
      }
    }
    
    return c.json(newTestCase, 201);
  } catch (error) {
    console.error('Create test case error:', error);
    return c.json({ error: 'Failed to create test case' }, 500);
  }
});

// POST /api/test-cases/import - Import test cases from CSV
testCasesRoutes.post('/import', requireAuth, async (c) => {
  const user = c.get('user')!;
  const db = createDb(c.env.DB);
  const contentType = c.req.header('content-type') || '';
  
  try {
    let data: any[];
    let folderId: number | null = null;
    
    if (contentType.includes('multipart/form-data')) {
      // Handle file upload via form
      const formData = await c.req.formData();
      const file = formData.get('file') as File | null;
      const folderIdStr = formData.get('folderId') as string | null;
      
      if (!file) {
        return c.json({ error: 'No file uploaded' }, 400);
      }
      
      if (folderIdStr && folderIdStr.trim()) {
        folderId = parseInt(folderIdStr);
      }
      
      // Read file content and parse CSV
      const fileContent = await file.text();
      const parsed = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
      });
      
      if (parsed.errors.length > 0) {
        return c.json({ error: 'Failed to parse CSV: ' + parsed.errors[0].message }, 400);
      }
      
      data = parsed.data;
    } else {
      // Handle JSON request (for backward compatibility)
      const body = await c.req.json();
      data = body.data;
      folderId = body.folderId || null;
    }
    
    if (!data || !Array.isArray(data)) {
      return c.json({ error: 'Invalid data format' }, 400);
    }
    
    const imported: any[] = [];
    const errors: any[] = [];
    
    // Group rows by test case
    // If rows have ID column, group by ID
    // If no ID column, treat each row with a title as a separate test case
    const testCaseGroups: any[][] = [];
    let currentGroup: any[] = [];
    
    const hasIdColumn = data.length > 0 && ('id' in data[0]);
    
    for (const row of data) {
      if (hasIdColumn) {
        // Group by ID - rows with ID start a new test case, rows without ID are steps
        if (row.id && row.id.trim()) {
          if (currentGroup.length > 0) {
            testCaseGroups.push(currentGroup);
          }
          currentGroup = [row];
        } else if (currentGroup.length > 0) {
          currentGroup.push(row);
        }
      } else {
        // No ID column - each row with a title is a separate test case
        if (row.title && row.title.trim()) {
          testCaseGroups.push([row]);
        }
      }
    }
    
    if (hasIdColumn && currentGroup.length > 0) {
      testCaseGroups.push(currentGroup);
    }
    
    for (let groupIndex = 0; groupIndex < testCaseGroups.length; groupIndex++) {
      const group = testCaseGroups[groupIndex];
      const firstRow = group[0];
      
      try {
        if (!firstRow.title || !firstRow.title.trim()) {
          errors.push({ row: groupIndex + 1, error: 'Title is required' });
          continue;
        }
        
        // Find or create folder from location path
        let targetFolderId = folderId;
        
        if (firstRow.location && firstRow.location.trim()) {
          const folderPath = firstRow.location.trim().split('\\').filter((p: string) => p);
          let currentParentId: number | null = null;
          
          for (const folderName of folderPath) {
            let folder;
            
            if (currentParentId === null) {
              const [existingFolder] = await db
                .select()
                .from(folders)
                .where(and(eq(folders.name, folderName), isNull(folders.parentId)))
                .limit(1);
              folder = existingFolder;
            } else {
              const [existingFolder] = await db
                .select()
                .from(folders)
                .where(and(eq(folders.name, folderName), eq(folders.parentId, currentParentId)))
                .limit(1);
              folder = existingFolder;
            }
            
            if (!folder) {
              [folder] = await db
                .insert(folders)
                .values({
                  name: folderName,
                  parentId: currentParentId,
                  projectName: 'Default',
                })
                .returning();
            }
            
            currentParentId = folder.id;
          }
          
          if (currentParentId !== null) {
            targetFolderId = currentParentId;
          }
        }
        
        // Create test case - handle various CSV header formats (lowercase from transform)
        const isAutomatedValue = 
          firstRow.isautomated?.toLowerCase() === 'yes' || 
          firstRow.isautomated?.toLowerCase() === 'true' ||
          firstRow.automated?.toLowerCase() === 'yes' || 
          firstRow.automated?.toLowerCase() === 'true';
        
        const [newTestCase] = await db
          .insert(testCases)
          .values({
            title: firstRow.title.trim(),
            description: firstRow.description?.trim() || null,
            preConditions: firstRow.preconditions?.trim() || firstRow.preconditions?.trim() || null,
            priority: firstRow.priority || 'Medium',
            status: firstRow.status || 'Draft',
            isAutomated: isAutomatedValue,
            folderId: targetFolderId || null,
            authorId: user.id,
          })
          .returning();
        
        // Create steps
        const stepsToCreate = [];
        for (const row of group) {
          if (row.stepnumber && row.stepaction) {
            stepsToCreate.push({
              testCaseId: newTestCase.id,
              stepNumber: parseInt(row.stepnumber) || stepsToCreate.length + 1,
              action: row.stepaction.trim(),
              expectedResult: row.expectedresult?.trim() || null,
            });
          }
        }
        
        if (stepsToCreate.length > 0) {
          await db.insert(testCaseSteps).values(stepsToCreate);
        }
        
        // Handle tags
        if (firstRow.tags && firstRow.tags.trim()) {
          const tagNames = firstRow.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
          
          for (const tagName of tagNames) {
            let [tag] = await db.select().from(tags).where(eq(tags.name, tagName)).limit(1);
            
            if (!tag) {
              [tag] = await db.insert(tags).values({ name: tagName }).returning();
            }
            
            await db.insert(testCaseTags).values({
              testCaseId: newTestCase.id,
              tagId: tag.id,
            });
          }
        }
        
        imported.push(newTestCase);
      } catch (error: any) {
        errors.push({ row: groupIndex + 1, error: error.message });
      }
    }
    
    // If it was a form submission, redirect to test-plan page
    if (contentType.includes('multipart/form-data')) {
      return c.redirect('/test-plan?imported=' + imported.length);
    }
    
    return c.json({
      success: true,
      imported: imported.length,
      errors: errors.length,
      details: errors,
    });
  } catch (error: any) {
    console.error('Import error:', error);
    
    // If it was a form submission, redirect back with error
    if (contentType.includes('multipart/form-data')) {
      return c.redirect('/test-plan/import?error=' + encodeURIComponent(error.message || 'Failed to import'));
    }
    
    return c.json({ error: 'Failed to import test cases' }, 500);
  }
});

// PUT /api/test-cases/:id - Update test case
testCasesRoutes.put('/:id', requireAuth, zValidator('json', createTestCaseSchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);
  
  try {
    // Update test case
    const [updatedTestCase] = await db
      .update(testCases)
      .set({
        title: data.title,
        description: data.description || null,
        preConditions: data.preConditions || null,
        priority: data.priority || 'Medium',
        status: data.status || 'Draft',
        isAutomated: data.isAutomated || false,
        folderId: data.folderId || null,
      })
      .where(eq(testCases.id, id))
      .returning();
    
    if (!updatedTestCase) {
      return c.json({ error: 'Test case not found' }, 404);
    }
    
    // Update steps - delete existing and recreate
    await db.delete(testCaseSteps).where(eq(testCaseSteps.testCaseId, id));
    
    if (data.steps && data.steps.length > 0) {
      await db.insert(testCaseSteps).values(
        data.steps.map((step, index) => ({
          testCaseId: id,
          stepNumber: index + 1,
          action: step.action,
          expectedResult: step.expectedResult || null,
        }))
      );
    }
    
    // Update tags - delete existing and recreate
    await db.delete(testCaseTags).where(eq(testCaseTags.testCaseId, id));
    
    if (data.tags && data.tags.length > 0) {
      for (const tagName of data.tags) {
        let [tag] = await db.select().from(tags).where(eq(tags.name, tagName)).limit(1);
        
        if (!tag) {
          [tag] = await db.insert(tags).values({ name: tagName }).returning();
        }
        
        await db.insert(testCaseTags).values({
          testCaseId: id,
          tagId: tag.id,
        });
      }
    }
    
    return c.json(updatedTestCase);
  } catch (error) {
    console.error('Update test case error:', error);
    return c.json({ error: 'Failed to update test case' }, 500);
  }
});

// DELETE /api/test-cases/:id - Delete test case
testCasesRoutes.delete('/:id', requireAuth, async (c) => {
  const id = parseInt(c.req.param('id'));
  const db = createDb(c.env.DB);
  
  try {
    const [deletedTestCase] = await db
      .delete(testCases)
      .where(eq(testCases.id, id))
      .returning();
    
    if (!deletedTestCase) {
      return c.json({ error: 'Test case not found' }, 404);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete test case error:', error);
    return c.json({ error: 'Failed to delete test case' }, 500);
  }
});

// DELETE /api/test-cases/bulk-delete - Bulk delete test cases
testCasesRoutes.delete('/bulk-delete', requireAuth, zValidator('json', bulkDeleteSchema), async (c) => {
  const { testCaseIds } = c.req.valid('json');
  const db = createDb(c.env.DB);
  
  if (!testCaseIds || testCaseIds.length === 0) {
    return c.json({ error: 'No test case IDs provided' }, 400);
  }
  
  try {
    await db.delete(testCases).where(inArray(testCases.id, testCaseIds));
    
    return c.json({ 
      success: true, 
      deletedCount: testCaseIds.length 
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return c.json({ error: 'Failed to delete test cases' }, 500);
  }
});

export { testCasesRoutes };

