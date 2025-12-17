import { createMiddleware } from 'hono/factory';
import type { Bindings, User } from '../types';
import { getTokenFromCookie, verifyToken } from '../lib/auth';
import { createDb } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

// Extend Hono context with user
declare module 'hono' {
  interface ContextVariableMap {
    user: User | null;
    isAuthenticated: boolean;
  }
}

// Auth middleware - parses token but doesn't require auth
export const authMiddleware = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  const cookieHeader = c.req.header('Cookie');
  const token = getTokenFromCookie(cookieHeader);
  
  if (!token) {
    c.set('user', null);
    c.set('isAuthenticated', false);
    return next();
  }
  
  const payload = await verifyToken(token, c.env.JWT_SECRET);
  
  if (!payload) {
    c.set('user', null);
    c.set('isAuthenticated', false);
    return next();
  }
  
  // Fetch user from database
  const db = createDb(c.env.DB);
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
    })
    .from(users)
    .where(eq(users.id, parseInt(payload.sub)))
    .limit(1);
  
  if (!user) {
    c.set('user', null);
    c.set('isAuthenticated', false);
    return next();
  }
  
  c.set('user', user);
  c.set('isAuthenticated', true);
  return next();
});

// Require auth middleware - returns 401 if not authenticated
export const requireAuth = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  return next();
});

// Require auth for mutations middleware
export const requireAuthForMutations = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  const method = c.req.method;
  
  // Allow GET requests for everyone (guest viewing)
  if (method === 'GET') {
    return next();
  }
  
  // Require auth for mutations
  const user = c.get('user');
  if (!user && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  return next();
});

