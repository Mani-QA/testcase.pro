import { Hono } from 'hono';
import type { Bindings } from '../../types';
import { authMiddleware } from '../../middleware/auth';

// Import page handlers
import { dashboardPage } from './dashboard';
import { testPlanPage, testCaseViewPage, testCaseEditPage, testCaseNewPage, importCsvPage } from './test-plan';
import { testRunListPage, testRunExecutePage, testRunCreatePage } from './test-run';
import { reportsPage } from './reports';
import { signInPage, signUpPage } from './auth';

const pageRoutes = new Hono<{ Bindings: Bindings }>();

// Apply auth middleware to all routes
pageRoutes.use('*', authMiddleware);

// Home redirect
pageRoutes.get('/', (c) => c.redirect('/dashboard'));

// Dashboard
pageRoutes.get('/dashboard', dashboardPage);

// Test Plan pages
pageRoutes.get('/test-plan', testPlanPage);
pageRoutes.get('/test-plan/import', importCsvPage);
pageRoutes.get('/test-case/new', testCaseNewPage);
pageRoutes.get('/test-case/:id', testCaseViewPage);
pageRoutes.get('/test-case/:id/edit', testCaseEditPage);

// Test Run pages
pageRoutes.get('/test-run', testRunListPage);
pageRoutes.get('/test-run/create', testRunCreatePage);
pageRoutes.get('/test-run/:id', testRunExecutePage);

// Reports
pageRoutes.get('/reports', reportsPage);

// Auth pages
pageRoutes.get('/auth/signin', signInPage);
pageRoutes.get('/auth/signup', signUpPage);

export { pageRoutes };

