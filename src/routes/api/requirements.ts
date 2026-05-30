import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Bindings } from '../../types';
import { createDb } from '../../db';
import { requirements, testCaseRequirements, testCases, testCaseSteps } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';
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
      await stream.write(`data: ${JSON.stringify({ status: 'reading' })}\n\n`);
      
      const db = createDb(c.env.DB);
      
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
      await stream.write(`data: ${JSON.stringify({ status: 'scenarios' })}\n\n`);
      
      if (!c.env.AI) {
        await stream.write(`data: ${JSON.stringify({ status: 'error', message: 'Workers AI binding is missing in environment' })}\n\n`);
        return;
      }
      
      // Call Cloudflare Workers AI using meta llama 3 8b
      const systemPrompt = `You are a senior full-stack QA engineer. Given the following user story/requirement, generate a comprehensive list of high-quality test cases to fully validate the implementation.
Ensure both happy path and edge cases are generated. Provide between 3 to 6 test cases for depth.

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

      const aiResponse = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate or regenerate the comprehensive QA test cases for requirement: ${requirement.title}` }
        ],
        max_tokens: 2048
      });
      
      let rawText = aiResponse.response || aiResponse;
      if (typeof rawText !== 'string') {
        throw new Error('AI response format was invalid.');
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
        throw new Error('AI response did not return valid JSON formatted test cases.');
      }
      
      if (!Array.isArray(generatedCases)) {
        throw new Error('AI response must be an array of test cases.');
      }
      
      // 3. Creating/Regenerating milestone
      const total = generatedCases.length;
      const matchedIds: number[] = [];
      
      // Run modifications on D1 SQLite database sequentially
      for (let i = 0; i < total; i++) {
        const gen = generatedCases[i];
        
        // Stream current progress
        await stream.write(`data: ${JSON.stringify({ status: 'creating', current: i + 1, total })}\n\n`);
        
        // Find matching existing test case by comparing titles or descriptions
        const match = existingCasesWithSteps.find(ec => 
          ec.title.trim().toLowerCase() === gen.title.trim().toLowerCase() ||
          (ec.description && gen.description && ec.description.trim().toLowerCase() === gen.description.trim().toLowerCase())
        );
        
        if (match) {
          matchedIds.push(match.id);
          
          // Update matched test case details
          await db
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
          await db.delete(testCaseSteps).where(eq(testCaseSteps.testCaseId, match.id));
          
          if (gen.steps && gen.steps.length > 0) {
            await db.insert(testCaseSteps).values(
              gen.steps.map((s: any, idx: number) => ({
                testCaseId: match.id,
                stepNumber: idx + 1,
                action: s.action,
                expectedResult: s.expectedResult || null,
              }))
            );
          }
        } else {
          // Unmatched - create as a brand-new test case
          const [newCase] = await db
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
            await db.insert(testCaseSteps).values(
              gen.steps.map((s: any, idx: number) => ({
                testCaseId: newCase.id,
                stepNumber: idx + 1,
                action: s.action,
                expectedResult: s.expectedResult || null,
              }))
            );
          }
          
          // Link junction mapping
          await db.insert(testCaseRequirements).values({
            testCaseId: newCase.id,
            requirementId: id,
          });
        }
      }
      
      // Detach or delete existing cases no longer present in the generated list
      const unmatchedCases = existingCasesWithSteps.filter(ec => !matchedIds.includes(ec.id));
      for (const ec of unmatchedCases) {
        // Drizzle cascade references delete junction mapping automatically
        await db.delete(testCases).where(eq(testCases.id, ec.id));
      }
      
      // Stream completion
      await stream.write(`data: ${JSON.stringify({ status: 'complete' })}\n\n`);
      
    } catch (err: any) {
      console.error('SSE Generator execution error:', err);
      await stream.write(`data: ${JSON.stringify({ status: 'error', message: err.message || 'Generation failed' })}\n\n`);
    }
  });
});

export { requirementsRoutes };
