import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Bindings } from '../../types';
import { createDb } from '../../db';
import { requirements, testCaseRequirements, testCases, testCaseSteps, tags, testCaseTags } from '../../db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { authMiddleware, requireAuth } from '../../middleware/auth';
import { streamText } from 'hono/streaming';

const requirementsRoutes = new Hono<{ Bindings: Bindings }>();

// Apply auth middleware to resolve user context
requirementsRoutes.use('*', authMiddleware);

const createRequirementSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
});

// GET /api/requirements - Fetch all user stories/requirements
requirementsRoutes.get('/', async (c) => {
  const db = createDb(c.env.DB);
  
  try {
    const results = await db
      .select({
        id: requirements.id,
        reqId: requirements.reqId,
        title: requirements.title,
        description: requirements.description,
        status: requirements.status,
        createdAt: requirements.createdAt,
        testCaseCount: sql<number>`count(${testCaseRequirements.testCaseId})`,
      })
      .from(requirements)
      .leftJoin(testCaseRequirements, eq(requirements.id, testCaseRequirements.requirementId))
      .groupBy(requirements.id)
      .orderBy(requirements.reqId);
    
    return c.json(results);
  } catch (error) {
    console.error('Get requirements error:', error);
    return c.json({ error: 'Failed to fetch requirements' }, 500);
  }
});

// POST /api/requirements - Create a new user story/requirement
requirementsRoutes.post('/', requireAuth, zValidator('json', createRequirementSchema), async (c) => {
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);
  
  try {
    // Generate reqId sequentially (e.g. REQ-001, REQ-002...)
    const requirementsList = await db.select().from(requirements);
    let nextNumber = 1;
    if (requirementsList.length > 0) {
      const numbers = requirementsList.map(r => {
        const match = r.reqId.match(/REQ-(\d+)/);
        return match ? parseInt(match[1]) : 0;
      });
      nextNumber = Math.max(...numbers) + 1;
    }
    
    const reqId = `REQ-${String(nextNumber).padStart(3, '0')}`;
    
    const [newReq] = await db
      .insert(requirements)
      .values({
        reqId,
        title: data.title,
        description: data.description || null,
        status: data.status || 'Open',
      })
      .returning();
      
    return c.json(newReq, 201);
  } catch (error) {
    console.error('Create requirement error:', error);
    return c.json({ error: 'Failed to create requirement' }, 500);
  }
});

// PUT /api/requirements/:id - Update a requirement
requirementsRoutes.put('/:id', requireAuth, zValidator('json', createRequirementSchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);
  
  try {
    const [updated] = await db
      .update(requirements)
      .set({
        title: data.title,
        description: data.description || null,
        status: data.status || 'Open',
      })
      .where(eq(requirements.id, id))
      .returning();
      
    if (!updated) {
      return c.json({ error: 'Requirement not found' }, 404);
    }
    
    return c.json(updated);
  } catch (error) {
    console.error('Update requirement error:', error);
    return c.json({ error: 'Failed to update requirement' }, 500);
  }
});

// DELETE /api/requirements/:id - Delete a requirement
requirementsRoutes.delete('/:id', requireAuth, async (c) => {
  const id = parseInt(c.req.param('id'));
  const db = createDb(c.env.DB);
  
  try {
    const [deleted] = await db
      .delete(requirements)
      .where(eq(requirements.id, id))
      .returning();
      
    if (!deleted) {
      return c.json({ error: 'Requirement not found' }, 404);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete requirement error:', error);
    return c.json({ error: 'Failed to delete requirement' }, 500);
  }
});

// POST /api/requirements/:id/generate-test-cases - AI Execution SSE Endpoint
requirementsRoutes.post('/:id/generate-test-cases', requireAuth, async (c) => {
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const folderId = body.folderId ? parseInt(body.folderId) : null;
  const user = c.get('user')!;
  
  // Set SSE response headers
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  
  return streamText(c, async (stream) => {
    try {
      // 1. Reading milestone
      await stream.write(`data: ${JSON.stringify({ status: 'reading', message: 'Reading User stories...' })}\n\n`);
      
      const db = createDb(c.env.DB);
      
      // Ensure "AI Generated" tag exists in DB
      let [aiTag] = await db.select().from(tags).where(eq(tags.name, 'AI Generated')).limit(1);
      if (!aiTag) {
        [aiTag] = await db.insert(tags).values({ name: 'AI Generated' }).returning();
      }
      const tagId = aiTag.id;
      
      // Fetch requirement details
      const [requirement] = await db
        .select()
        .from(requirements)
        .where(eq(requirements.id, id))
        .limit(1);
        
      if (!requirement) {
        await stream.write(`data: ${JSON.stringify({ status: 'error', message: 'Requirement not found' })}\n\n`);
        return;
      }
      
      // Fetch existing test cases linked to this requirement
      const existingCases = await db
        .select({
          id: testCases.id,
          title: testCases.title,
          description: testCases.description,
          preConditions: testCases.preConditions,
          priority: testCases.priority,
          status: testCases.status,
        })
        .from(testCaseRequirements)
        .innerJoin(testCases, eq(testCaseRequirements.testCaseId, testCases.id))
        .where(eq(testCaseRequirements.requirementId, id));
        
      const existingCasesWithSteps = await Promise.all(
        existingCases.map(async (tc) => {
          const steps = await db
            .select()
            .from(testCaseSteps)
            .where(eq(testCaseSteps.testCaseId, tc.id))
            .orderBy(testCaseSteps.stepNumber);
          return { ...tc, steps };
        })
      );
      
      // 2. Scenarios planning milestone
      await stream.write(`data: ${JSON.stringify({ status: 'scenarios', message: 'Figuring out test scenarios...' })}\n\n`);
      
      if (!c.env.AI) {
        await stream.write(`data: ${JSON.stringify({ status: 'error', message: 'Workers AI binding is missing in environment' })}\n\n`);
        return;
      }
      
      const systemPrompt = `You are a senior full-stack QA engineer. Given the following user story/requirement, generate a comprehensive list of high-quality test cases to fully validate the implementation.
Ensure both happy path and edge cases are generated. Provide between 3 to 6 test cases for depth.

Each generated test case MUST be highly detailed and consist of multiple, granular sequential steps (between 4 to 8 distinct steps per case). 
Do NOT generate a single generic step or summarize the entire test in one step. Instead, break it down chronologically:
- Step 1: Pre-requisites or navigation (e.g., Login as user, navigate to the target module/page).
- Step 2 to N-1: Sequential interaction steps (e.g., Click specific button/link, fill out a specific text field, select option from dropdown, submit the form).
- Final Step: Outcome verification and side-effects validation (e.g., check message display, redirect target, database state).

For every step, write a concrete, action-oriented "action" description and a specific "expectedResult" showing what the system should show or perform.

Example of sequential steps for a search story:
- Step 1: Action: 'Log in as a registered customer and navigate to the dashboard', ExpectedResult: 'User is successfully logged in and dashboard displays'
- Step 2: Action: 'Click on the Search box in the top-right corner of the header', ExpectedResult: 'Cursor is focused inside the search box'
- Step 3: Action: 'Type "Laptop" in the search box and press the search icon', ExpectedResult: 'Results list is filtered and loaded displaying matched items'
- Step 4: Action: 'Verify that "Premium Laptop" is listed with the correct price and detail page button', ExpectedResult: '"Premium Laptop" displays in the list with a price of $999'

Requirement Details:
Unique ID: ${requirement.reqId}
Title: ${requirement.title}
Description: ${requirement.description || 'None'}

Current existing test cases for context:
${JSON.stringify(existingCasesWithSteps.map(ec => ({ title: ec.title, description: ec.description, stepsCount: ec.steps.length })), null, 2)}

You MUST respond strictly with a valid JSON array of test cases. Do not include any extra text, introductions, markdown wrappers (like \`\`\`json), or descriptions outside of the JSON block.
Ensure the returned JSON array matches this TypeScript structure:
[
  {
    "title": "Test case title string",
    "description": "Short explanation of the test intent",
    "preconditions": "Setup state or dependencies (optional)",
    "priority": "High" | "Medium" | "Low",
    "steps": [
      {
        "action": "Step action to perform",
        "expectedResult": "Expected state or outcome after action"
      }
    ]
  }
]`;

      const aiStream = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate or regenerate the comprehensive QA test cases for requirement: ${requirement.title}` }
        ],
        stream: true,
      }) as any;

      let rawText = '';
      const reader = aiStream.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        rawText += chunk;
        
        // Count matches of separator pattern `}\s*,\s*{` to estimate current count
        const matches = rawText.match(/}\s*,\s*{/g);
        const runningCount = matches ? matches.length + 1 : 1;
        
        await stream.write(`data: ${JSON.stringify({ 
          status: 'creating', 
          message: `Creating Test cases (${runningCount}/...)`,
          current: runningCount,
          total: 0
        })}\n\n`);
      }
      
      // Clean markdown code blocks from response
      let cleanText = rawText.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(json)?\s*/i, '');
        cleanText = cleanText.replace(/\s*```$/, '');
      }
      cleanText = cleanText.trim();
      
      let generatedCases: any[];
      try {
        generatedCases = JSON.parse(cleanText);
      } catch (err) {
        console.error('Failed to parse AI output as JSON:', cleanText);
        await stream.write(`data: ${JSON.stringify({ status: 'error', message: 'AI response did not return valid JSON formatted test cases.' })}\n\n`);
        return;
      }
      
      if (!Array.isArray(generatedCases)) {
        await stream.write(`data: ${JSON.stringify({ status: 'error', message: 'AI response must be an array of test cases.' })}\n\n`);
        return;
      }
      
      const matchedIds: number[] = [];
      
      // Execute the database synchronizations in a transaction
      await db.transaction(async (tx) => {
        const total = generatedCases.length;
        
        for (let i = 0; i < total; i++) {
          const gen = generatedCases[i];
          
          await stream.write(`data: ${JSON.stringify({ 
            status: 'creating', 
            message: `Creating Test cases (${i + 1}/${total})`,
            current: i + 1,
            total
          })}\n\n`);
          
          // Find matching existing test case by comparing titles or descriptions
          const match = existingCasesWithSteps.find(ec => 
            ec.title.trim().toLowerCase() === gen.title.trim().toLowerCase() ||
            (ec.description && gen.description && ec.description.trim().toLowerCase() === gen.description.trim().toLowerCase())
          );
          
          if (match) {
            matchedIds.push(match.id);
            
            // Update matched test case details
            await tx
              .update(testCases)
              .set({
                title: gen.title,
                description: gen.description || null,
                preConditions: gen.preconditions || null,
                priority: gen.priority || 'Medium',
                status: 'Draft',
              })
              .where(eq(testCases.id, match.id));
              
            // Reset existing steps and insert new steps
            await tx.delete(testCaseSteps).where(eq(testCaseSteps.testCaseId, match.id));
            
            if (gen.steps && gen.steps.length > 0) {
              await tx.insert(testCaseSteps).values(
                gen.steps.map((s: any, idx: number) => ({
                  testCaseId: match.id,
                  stepNumber: idx + 1,
                  action: s.action,
                  expectedResult: s.expectedResult || null,
                }))
              );
            }
            
            // Link tag if not already linked
            const [existingTagLink] = await tx
              .select()
              .from(testCaseTags)
              .where(and(eq(testCaseTags.testCaseId, match.id), eq(testCaseTags.tagId, tagId)))
              .limit(1);
            if (!existingTagLink) {
              await tx.insert(testCaseTags).values({
                testCaseId: match.id,
                tagId: tagId,
              });
            }
          } else {
            // Unmatched - create as a brand-new test case
            const [newCase] = await tx
              .insert(testCases)
              .values({
                title: gen.title,
                description: gen.description || null,
                preConditions: gen.preconditions || null,
                priority: gen.priority || 'Medium',
                status: 'Draft',
                isAutomated: false,
                folderId: folderId,
                authorId: user.id,
              })
              .returning();
              
            // Insert steps
            if (gen.steps && gen.steps.length > 0) {
              await tx.insert(testCaseSteps).values(
                gen.steps.map((s: any, idx: number) => ({
                  testCaseId: newCase.id,
                  stepNumber: idx + 1,
                  action: s.action,
                  expectedResult: s.expectedResult || null,
                }))
              );
            }
            
            // Link junction mapping
            await tx.insert(testCaseRequirements).values({
              testCaseId: newCase.id,
              requirementId: id,
            });
            
            // Link tag
            await tx.insert(testCaseTags).values({
              testCaseId: newCase.id,
              tagId: tagId,
            });
          }
        }
        
        // Detach or delete existing cases no longer present in the generated list
        const unmatchedCases = existingCasesWithSteps.filter(ec => !matchedIds.includes(ec.id));
        for (const ec of unmatchedCases) {
          // Delete test case and references explicitly inside the transaction block
          await tx.delete(testCaseSteps).where(eq(testCaseSteps.testCaseId, ec.id));
          await tx.delete(testCaseTags).where(eq(testCaseTags.testCaseId, ec.id));
          await tx.delete(testCaseRequirements).where(eq(testCaseRequirements.testCaseId, ec.id));
          await tx.delete(testCases).where(eq(testCases.id, ec.id));
        }
      });
      
      // Emit done milestone
      await stream.write(`data: ${JSON.stringify({ status: 'done', message: 'Generation complete!' })}\n\n`);
      
    } catch (err: any) {
      console.error('SSE Generator execution error:', err);
      await stream.write(`data: ${JSON.stringify({ status: 'error', message: err.message || 'Generation failed' })}\n\n`);
    }
  });
});

export { requirementsRoutes };
