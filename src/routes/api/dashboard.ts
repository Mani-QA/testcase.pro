import { Hono } from 'hono';
import type { Bindings } from '../../types';
import { createDb } from '../../db';
import { testCases, testSuites, testRunEntries } from '../../db/schema';
import { sql, gte } from 'drizzle-orm';
import { authMiddleware } from '../../middleware/auth';
import { format, subDays } from 'date-fns';

const dashboardRoutes = new Hono<{ Bindings: Bindings }>();

// Apply middleware
dashboardRoutes.use('*', authMiddleware);

// GET /api/dashboard/stats - Get dashboard statistics
dashboardRoutes.get('/stats', async (c) => {
  const db = createDb(c.env.DB);
  
  try {
    // Get totals
    const [testCaseCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(testCases);
    
    const [testSuiteCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(testSuites);
    
    const [testRunCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(testRunEntries);
    
    // Get status distribution
    const statusDistribution = await db
      .select({
        status: testRunEntries.status,
        count: sql<number>`count(*)`,
      })
      .from(testRunEntries)
      .groupBy(testRunEntries.status);
    
    // Get execution trend (last 30 days)
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    
    const executionTrend = await db
      .select({
        date: sql<string>`date(${testRunEntries.executedAt})`,
        count: sql<number>`count(*)`,
      })
      .from(testRunEntries)
      .where(gte(testRunEntries.executedAt, thirtyDaysAgo))
      .groupBy(sql`date(${testRunEntries.executedAt})`)
      .orderBy(sql`date(${testRunEntries.executedAt})`);
    
    return c.json({
      statusDistribution: statusDistribution.map(s => ({
        status: s.status || 'Not Run',
        count: Number(s.count),
      })),
      executionTrend: executionTrend.map(e => ({
        date: e.date ? format(new Date(e.date), 'MMM d') : 'Unknown',
        count: Number(e.count),
      })),
      summary: {
        totalTestCases: Number(testCaseCount?.count || 0),
        totalTestSuites: Number(testSuiteCount?.count || 0),
        totalTestRuns: Number(testRunCount?.count || 0),
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return c.json({ error: 'Failed to fetch dashboard stats' }, 500);
  }
});

export { dashboardRoutes };

