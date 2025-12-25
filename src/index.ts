import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { etag } from 'hono/etag';
import type { Bindings } from './types';

// Import routes
import { authRoutes } from './routes/api/auth';
import { foldersRoutes } from './routes/api/folders';
import { testCasesRoutes } from './routes/api/test-cases';
import { tagsRoutes } from './routes/api/tags';
import { testSuitesRoutes } from './routes/api/test-suites';
import { testRunsRoutes } from './routes/api/test-runs';
import { dashboardRoutes } from './routes/api/dashboard';

// Import page routes
import { pageRoutes } from './routes/pages';

// Import CSS content directly (for Workers)
import { cssContent } from './static/styles';

// Import cache utilities
import { CacheTTL } from './middleware/cache';

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', logger());
app.use('/api/*', cors());

// ETag middleware for conditional requests (304 responses)
// This reduces bandwidth by not sending content if it hasn't changed
app.use('/static/*', etag());
app.use('/api/*', etag());

// Serve CSS directly with long cache TTL (static asset)
// This is cached for 1 year with immutable flag
app.get('/static/styles.css', (c) => {
  return c.text(cssContent, 200, {
    'Content-Type': 'text/css',
    'Cache-Control': `public, max-age=${CacheTTL.STATIC}, s-maxage=${CacheTTL.STATIC}, immutable`,
  });
});

// Serve external libraries from CDN with caching proxy
// This reduces requests by caching CDN responses at the edge
app.get('/static/cdn/*', async (c) => {
  const path = c.req.path.replace('/static/cdn/', '');
  const cdnUrl = `https://cdn.jsdelivr.net/npm/${path}`;
  
  // Check edge cache first
  const cache = caches.default;
  const cacheKey = new Request(cdnUrl);
  const cachedResponse = await cache.match(cacheKey);
  
  if (cachedResponse) {
    const response = new Response(cachedResponse.body, cachedResponse);
    response.headers.set('X-Cache', 'HIT');
    return response;
  }
  
  // Fetch from CDN
  const response = await fetch(cdnUrl);
  
  if (response.ok) {
    const newResponse = new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/javascript',
        'Cache-Control': `public, max-age=${CacheTTL.STATIC}, immutable`,
        'X-Cache': 'MISS',
      },
    });
    
    // Cache at edge (non-blocking)
    c.executionCtx.waitUntil(cache.put(cacheKey, newResponse.clone()));
    
    return newResponse;
  }
  
  return c.text('Not found', 404);
});

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/folders', foldersRoutes);
app.route('/api/test-cases', testCasesRoutes);
app.route('/api/tags', tagsRoutes);
app.route('/api/test-suites', testSuitesRoutes);
app.route('/api/test-runs', testRunsRoutes);
app.route('/api/dashboard', dashboardRoutes);

// Page Routes (SSR)
app.route('/', pageRoutes);

export default app;

