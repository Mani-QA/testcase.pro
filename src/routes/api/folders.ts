import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Bindings } from '../../types';
import { createDb } from '../../db';
import { folders } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware, requireAuthForMutations } from '../../middleware/auth';
import { setCacheHeaders, CacheTTL } from '../../middleware/cache';

const foldersRoutes = new Hono<{ Bindings: Bindings }>();

// Apply middleware
foldersRoutes.use('*', authMiddleware);
foldersRoutes.use('*', requireAuthForMutations);

// Create folder schema
const createFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required'),
  parentId: z.number().nullable().optional(),
  projectName: z.string().optional(),
});

// Update folder schema
const updateFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required'),
  parentId: z.number().nullable().optional(),
});

// GET /api/folders - Get all folders
// Cache for 2 minutes - folder structure changes infrequently
foldersRoutes.get('/', async (c) => {
  const db = createDb(c.env.DB);
  
  try {
    const allFolders = await db.select().from(folders);
    
    // Set cache headers for edge caching
    setCacheHeaders(c, CacheTTL.LIST_API, { 
      staleWhileRevalidate: CacheTTL.LIST_API 
    });
    
    return c.json(allFolders);
  } catch (error) {
    console.error('Get folders error:', error);
    return c.json({ error: 'Failed to fetch folders' }, 500);
  }
});

// GET /api/folders/:id - Get folder by ID
// Cache for 1 minute - individual item cache
foldersRoutes.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const db = createDb(c.env.DB);
  
  try {
    const [folder] = await db
      .select()
      .from(folders)
      .where(eq(folders.id, id))
      .limit(1);
    
    if (!folder) {
      return c.json({ error: 'Folder not found' }, 404);
    }
    
    // Set cache headers for edge caching
    setCacheHeaders(c, CacheTTL.ITEM_API, { 
      staleWhileRevalidate: CacheTTL.ITEM_API 
    });
    
    return c.json(folder);
  } catch (error) {
    console.error('Get folder error:', error);
    return c.json({ error: 'Failed to fetch folder' }, 500);
  }
});

// POST /api/folders - Create folder
foldersRoutes.post('/', zValidator('json', createFolderSchema), async (c) => {
  const { name, parentId, projectName } = c.req.valid('json');
  const db = createDb(c.env.DB);
  
  try {
    const [newFolder] = await db
      .insert(folders)
      .values({
        name,
        parentId: parentId || null,
        projectName: projectName || 'Default',
      })
      .returning();
    
    return c.json(newFolder, 201);
  } catch (error) {
    console.error('Create folder error:', error);
    return c.json({ error: 'Failed to create folder' }, 500);
  }
});

// PUT /api/folders/:id - Update folder
foldersRoutes.put('/:id', zValidator('json', updateFolderSchema), async (c) => {
  const id = parseInt(c.req.param('id'));
  const { name, parentId } = c.req.valid('json');
  const db = createDb(c.env.DB);
  
  try {
    const [updatedFolder] = await db
      .update(folders)
      .set({
        name,
        parentId: parentId !== undefined ? parentId : undefined,
      })
      .where(eq(folders.id, id))
      .returning();
    
    if (!updatedFolder) {
      return c.json({ error: 'Folder not found' }, 404);
    }
    
    return c.json(updatedFolder);
  } catch (error) {
    console.error('Update folder error:', error);
    return c.json({ error: 'Failed to update folder' }, 500);
  }
});

// DELETE /api/folders/:id - Delete folder
foldersRoutes.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const db = createDb(c.env.DB);
  
  try {
    const [deletedFolder] = await db
      .delete(folders)
      .where(eq(folders.id, id))
      .returning();
    
    if (!deletedFolder) {
      return c.json({ error: 'Folder not found' }, 404);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete folder error:', error);
    return c.json({ error: 'Failed to delete folder' }, 500);
  }
});

export { foldersRoutes };

