import { Hono } from 'hono';
import type { Bindings } from '../../types';
import { createDb } from '../../db';
import { tags } from '../../db/schema';
import { authMiddleware } from '../../middleware/auth';

const tagsRoutes = new Hono<{ Bindings: Bindings }>();

// Apply middleware
tagsRoutes.use('*', authMiddleware);

// GET /api/tags - Get all tags
tagsRoutes.get('/', async (c) => {
  const db = createDb(c.env.DB);
  
  try {
    const allTags = await db.select().from(tags);
    return c.json(allTags);
  } catch (error) {
    console.error('Get tags error:', error);
    return c.json({ error: 'Failed to fetch tags' }, 500);
  }
});

export { tagsRoutes };

