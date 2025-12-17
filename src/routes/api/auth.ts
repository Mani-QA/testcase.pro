import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Bindings } from '../../types';
import { createDb } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { 
  hashPassword, 
  verifyPassword, 
  createToken, 
  createAuthCookie, 
  createLogoutCookie 
} from '../../lib/auth';
import { authMiddleware } from '../../middleware/auth';

const authRoutes = new Hono<{ Bindings: Bindings }>();

// Apply auth middleware to all routes
authRoutes.use('*', authMiddleware);

// Signup schema
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().optional(),
});

// Signin schema
const signinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/auth/signup - handles both JSON and form data
authRoutes.post('/signup', async (c) => {
  const contentType = c.req.header('Content-Type') || '';
  let email: string, password: string, fullName: string | undefined;
  
  if (contentType.includes('application/json')) {
    const body = await c.req.json();
    email = body.email;
    password = body.password;
    fullName = body.fullName;
  } else {
    const formData = await c.req.parseBody();
    email = formData.email as string;
    password = formData.password as string;
    fullName = formData.fullName as string | undefined;
  }
  
  if (!email || !password) {
    if (contentType.includes('application/json')) {
      return c.json({ error: 'Email and password are required' }, 400);
    }
    return c.redirect('/auth/signup?error=invalid');
  }
  
  const db = createDb(c.env.DB);
  
  try {
    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    
    if (existingUser) {
      const contentType = c.req.header('Content-Type') || '';
      if (contentType.includes('application/json')) {
        return c.json({ error: 'Email already registered' }, 400);
      }
      return c.redirect('/auth/signup?error=exists');
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        fullName: fullName || null,
      })
      .returning();
    
    // Create JWT token
    const token = await createToken(
      newUser.id,
      newUser.email,
      newUser.fullName,
      c.env.JWT_SECRET
    );
    
    // Set auth cookie
    c.header('Set-Cookie', createAuthCookie(token));
    
    const contentType = c.req.header('Content-Type') || '';
    if (contentType.includes('application/json')) {
      return c.json({
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.fullName || newUser.email,
        },
      });
    }
    return c.redirect('/dashboard');
  } catch (error) {
    console.error('Signup error:', error);
    const contentType = c.req.header('Content-Type') || '';
    if (contentType.includes('application/json')) {
      return c.json({ error: 'Failed to create account' }, 500);
    }
    return c.redirect('/auth/signup?error=failed');
  }
});

// POST /api/auth/signin - handles both JSON and form data
authRoutes.post('/signin', async (c) => {
  const contentType = c.req.header('Content-Type') || '';
  let email: string, password: string;
  
  if (contentType.includes('application/json')) {
    const body = await c.req.json();
    email = body.email;
    password = body.password;
  } else {
    const formData = await c.req.parseBody();
    email = formData.email as string;
    password = formData.password as string;
  }
  
  if (!email || !password) {
    if (contentType.includes('application/json')) {
      return c.json({ error: 'Email and password are required' }, 400);
    }
    return c.redirect('/auth/signin?error=invalid');
  }
  
  const db = createDb(c.env.DB);
  
  try {
    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    
    if (!user) {
      if (contentType.includes('application/json')) {
        return c.json({ error: 'Invalid email or password' }, 401);
      }
      return c.redirect('/auth/signin?error=invalid');
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    
    if (!isValidPassword) {
      if (contentType.includes('application/json')) {
        return c.json({ error: 'Invalid email or password' }, 401);
      }
      return c.redirect('/auth/signin?error=invalid');
    }
    
    // Create JWT token
    const token = await createToken(
      user.id,
      user.email,
      user.fullName,
      c.env.JWT_SECRET
    );
    
    // Set auth cookie
    c.header('Set-Cookie', createAuthCookie(token));
    
    const contentType = c.req.header('Content-Type') || '';
    if (contentType.includes('application/json')) {
      return c.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.fullName || user.email,
        },
      });
    }
    return c.redirect('/dashboard');
  } catch (error) {
    console.error('Signin error:', error);
    const contentType = c.req.header('Content-Type') || '';
    if (contentType.includes('application/json')) {
      return c.json({ error: 'Failed to sign in' }, 500);
    }
    return c.redirect('/auth/signin?error=failed');
  }
});

// POST /api/auth/signout
authRoutes.post('/signout', async (c) => {
  c.header('Set-Cookie', createLogoutCookie());
  return c.json({ success: true });
});

// GET /api/auth/session
authRoutes.get('/session', async (c) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ user: null });
  }
  
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.fullName || user.email,
    },
  });
});

export { authRoutes };

