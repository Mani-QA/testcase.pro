import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
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

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', logger());
app.use('/api/*', cors());

// Serve CSS directly
app.get('/static/styles.css', (c) => {
  return c.text(cssContent, 200, {
    'Content-Type': 'text/css',
    'Cache-Control': 'public, max-age=31536000',
  });
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

