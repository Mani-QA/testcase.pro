import type { Context } from 'hono';
import type { Bindings } from '../../types';
import { Layout } from '../../components/Layout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { createDb } from '../../db';
import { testCases, testSuites, testRunEntries } from '../../db/schema';
import { sql, gte } from 'drizzle-orm';
import { format, subDays } from 'date-fns';

const icons = {
  folder: `<svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>`,
  play: `<svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  check: `<svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  trend: `<svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>`,
  login: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>`,
};

export async function dashboardPage(c: Context<{ Bindings: Bindings }>) {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  
  // Get statistics
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
  
  // Get execution trend
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
  
  const stats = {
    totalTestCases: Number(testCaseCount?.count || 0),
    totalTestSuites: Number(testSuiteCount?.count || 0),
    totalTestRuns: Number(testRunCount?.count || 0),
  };
  
  const statusData = statusDistribution.map(s => ({
    status: s.status || 'Not Run',
    count: Number(s.count),
  }));
  
  const trendData = executionTrend.map(e => ({
    date: e.date ? format(new Date(e.date), 'MMM d') : 'Unknown',
    count: Number(e.count),
  }));
  
  const summaryCards = [
    { title: 'Total Test Cases', value: stats.totalTestCases, icon: icons.folder, color: 'from-primary-500 to-primary-600' },
    { title: 'Test Suites', value: stats.totalTestSuites, icon: icons.play, color: 'from-secondary-500 to-secondary-600' },
    { title: 'Test Runs', value: stats.totalTestRuns, icon: icons.check, color: 'from-success-500 to-success-600' },
  ];
  
  return c.html(
    <Layout user={user} currentPath="/dashboard" title="Dashboard">
      <div class="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-neutral-900 mb-2">Dashboard</h1>
          <p class="text-neutral-600">
            Overview of your test case management system
          </p>
        </div>

        {/* Guest Mode Banner */}
        {!user && (
          <Card className="mb-6 border-primary-200 bg-primary-50">
            <div class="flex items-start gap-4">
              <div class="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <span class="text-primary-600" dangerouslySetInnerHTML={{ __html: icons.check }} />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-primary-900 mb-2">
                  Welcome to TestCase Pro!
                </h3>
                <p class="text-primary-800 mb-4">
                  You're currently in <strong>guest mode</strong>. You can browse test cases, view test runs, and explore reports. 
                  To create and manage test cases, please sign in.
                </p>
                <div class="flex gap-3">
                  <Button variant="primary" href="/auth/signin" icon={icons.login}>
                    Sign In
                  </Button>
                  <Button variant="ghost" href="/auth/signup">
                    Create Account
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Summary Cards */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {summaryCards.map((card) => (
            <Card key={card.title} padding={false}>
              <div class="p-6">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-neutral-600 mb-1">{card.title}</p>
                    <p class="text-3xl font-bold text-neutral-900">{card.value}</p>
                  </div>
                  <div class={`w-14 h-14 bg-gradient-to-br ${card.color} rounded-xl flex items-center justify-center shadow-medium`}>
                    <span dangerouslySetInnerHTML={{ __html: card.icon }} />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <Card title="Test Status Overview" subtitle="Distribution across active test runs">
            {statusData.length > 0 ? (
              <div class="chart-container">
                <canvas id="statusChart"></canvas>
              </div>
            ) : (
              <div class="h-64 flex items-center justify-center text-neutral-500">
                No test run data available
              </div>
            )}
          </Card>

          {/* Execution Trend */}
          <Card title="Execution Trend" subtitle="Tests executed in the last 30 days">
            {trendData.length > 0 ? (
              <div class="chart-container">
                <canvas id="trendChart"></canvas>
              </div>
            ) : (
              <div class="h-64 flex items-center justify-center text-neutral-500">
                No execution trend data available
              </div>
            )}
          </Card>
        </div>

        {/* Welcome Message */}
        {stats.totalTestCases === 0 && (
          <Card className="mt-6">
            <div class="text-center py-8">
              <div class="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="text-primary-600" dangerouslySetInnerHTML={{ __html: icons.trend }} />
              </div>
              <h3 class="text-xl font-semibold text-neutral-900 mb-2">
                Welcome to TestCase Pro!
              </h3>
              <p class="text-neutral-600 mb-6 max-w-md mx-auto">
                Get started by creating your first test case in the Test Plan section.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Chart.js Initialization */}
      <script dangerouslySetInnerHTML={{ __html: `
        document.addEventListener('DOMContentLoaded', function() {
          const statusData = ${JSON.stringify(statusData)};
          const trendData = ${JSON.stringify(trendData)};
          
          const statusColors = {
            'Passed': '#22c55e',
            'Failed': '#ef4444',
            'Blocked': '#f59e0b',
            'Not Run': '#a3a3a3',
            'In Progress': '#3b82f6',
            'Hold': '#f59e0b',
            'Invalid': '#737373',
          };
          
          // Status Chart
          if (statusData.length > 0) {
            const statusCtx = document.getElementById('statusChart');
            if (statusCtx) {
              new Chart(statusCtx, {
                type: 'doughnut',
                data: {
                  labels: statusData.map(d => d.status),
                  datasets: [{
                    data: statusData.map(d => d.count),
                    backgroundColor: statusData.map(d => statusColors[d.status] || '#a3a3a3'),
                    borderWidth: 0,
                  }]
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                    }
                  }
                }
              });
            }
          }
          
          // Trend Chart
          if (trendData.length > 0) {
            const trendCtx = document.getElementById('trendChart');
            if (trendCtx) {
              new Chart(trendCtx, {
                type: 'line',
                data: {
                  labels: trendData.map(d => d.date),
                  datasets: [{
                    label: 'Executions',
                    data: trendData.map(d => d.count),
                    borderColor: '#0ea5e9',
                    backgroundColor: 'rgba(14, 165, 233, 0.1)',
                    fill: true,
                    tension: 0.4,
                  }]
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                    }
                  }
                }
              });
            }
          }
        });
      `}} />
    </Layout>
  );
}

