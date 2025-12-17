import type { Context } from 'hono';
import type { Bindings } from '../../types';
import { Layout } from '../../components/Layout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { createDb } from '../../db';
import { testCases, testSuites, testRunEntries, folders, users } from '../../db/schema';
import { sql, gte, desc, eq, and } from 'drizzle-orm';
import { format, subDays } from 'date-fns';
import { generateTestCaseId, formatDate } from '../../lib/utils';

const icons = {
  download: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>`,
  filter: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>`,
  columns: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/></svg>`,
};

export async function reportsPage(c: Context<{ Bindings: Bindings }>) {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  
  // Get query params for filters
  const priorityFilter = c.req.query('priority') || '';
  const statusFilter = c.req.query('status') || '';
  const automatedFilter = c.req.query('automated') || '';
  
  // Get overall stats
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
  
  // Get priority distribution
  const priorityDistribution = await db
    .select({
      priority: testCases.priority,
      count: sql<number>`count(*)`,
    })
    .from(testCases)
    .groupBy(testCases.priority);
  
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
  
  // Get recent test suites with pass rates
  const recentSuites = await db
    .select({
      suite: testSuites,
    })
    .from(testSuites)
    .orderBy(desc(testSuites.createdAt))
    .limit(5);
  
  const suiteStats = await Promise.all(
    recentSuites.map(async ({ suite }) => {
      const stats = await db
        .select({
          status: testRunEntries.status,
          count: sql<number>`count(*)`,
        })
        .from(testRunEntries)
        .where(sql`${testRunEntries.testSuiteId} = ${suite.id}`)
        .groupBy(testRunEntries.status);
      
      const total = stats.reduce((sum, s) => sum + Number(s.count), 0);
      const passed = Number(stats.find(s => s.status === 'Passed')?.count || 0);
      const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
      
      return {
        name: suite.title,
        passRate,
        total,
        passed,
      };
    })
  );
  
  // Get filtered test cases for the table
  let allTestCases = await db
    .select({
      testCase: testCases,
      folder: folders,
      author: users,
    })
    .from(testCases)
    .leftJoin(folders, eq(testCases.folderId, folders.id))
    .leftJoin(users, eq(testCases.authorId, users.id))
    .orderBy(desc(testCases.createdAt));
  
  // Apply filters
  if (priorityFilter) {
    allTestCases = allTestCases.filter(tc => tc.testCase.priority === priorityFilter);
  }
  if (statusFilter) {
    allTestCases = allTestCases.filter(tc => tc.testCase.status === statusFilter);
  }
  if (automatedFilter) {
    const isAutomated = automatedFilter === 'true';
    allTestCases = allTestCases.filter(tc => tc.testCase.isAutomated === isAutomated);
  }
  
  const statusData = statusDistribution.map(s => ({
    status: s.status || 'Not Run',
    count: Number(s.count),
  }));
  
  const priorityData = priorityDistribution.map(p => ({
    priority: p.priority || 'Medium',
    count: Number(p.count),
  }));
  
  const trendData = executionTrend.map(e => ({
    date: e.date ? format(new Date(e.date), 'MMM d') : 'Unknown',
    count: Number(e.count),
  }));
  
  // Calculate pass rate
  const totalRuns = statusData.reduce((sum, s) => sum + s.count, 0);
  const passedRuns = statusData.find(s => s.status === 'Passed')?.count || 0;
  const overallPassRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;
  
  // Build export URL with filters
  let exportUrl = '/api/test-cases/export';
  const exportParams = new URLSearchParams();
  if (priorityFilter) exportParams.set('priority', priorityFilter);
  if (statusFilter) exportParams.set('status', statusFilter);
  if (automatedFilter) exportParams.set('automated', automatedFilter);
  if (exportParams.toString()) exportUrl += '?' + exportParams.toString();
  
  return c.html(
    <Layout user={user} currentPath="/reports" title="Reports">
      <div class="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-3xl font-bold text-neutral-900 mb-2">Reports</h1>
            <p class="text-neutral-600">Analytics and insights from your test execution</p>
          </div>
          <Button variant="primary" icon={icons.download} href={exportUrl}>
            Export CSV
          </Button>
        </div>
        
        {/* Summary Stats */}
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <div class="text-center">
              <p class="text-4xl font-bold text-primary-600">{Number(testCaseCount?.count || 0)}</p>
              <p class="text-sm text-neutral-600 mt-1">Total Test Cases</p>
            </div>
          </Card>
          <Card>
            <div class="text-center">
              <p class="text-4xl font-bold text-secondary-600">{Number(testSuiteCount?.count || 0)}</p>
              <p class="text-sm text-neutral-600 mt-1">Test Suites</p>
            </div>
          </Card>
          <Card>
            <div class="text-center">
              <p class="text-4xl font-bold text-neutral-900">{Number(testRunCount?.count || 0)}</p>
              <p class="text-sm text-neutral-600 mt-1">Total Executions</p>
            </div>
          </Card>
          <Card>
            <div class="text-center">
              <p class="text-4xl font-bold text-success-600">{overallPassRate}%</p>
              <p class="text-sm text-neutral-600 mt-1">Overall Pass Rate</p>
            </div>
          </Card>
        </div>
        
        {/* Charts Row */}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Status Distribution */}
          <Card title="Execution Status" subtitle="Distribution of test results">
            {statusData.length > 0 ? (
              <div class="chart-container">
                <canvas id="statusPieChart"></canvas>
              </div>
            ) : (
              <div class="h-64 flex items-center justify-center text-neutral-500">
                No execution data available
              </div>
            )}
          </Card>
          
          {/* Priority Distribution */}
          <Card title="Test Case Priority" subtitle="Distribution by priority level">
            {priorityData.length > 0 ? (
              <div class="chart-container">
                <canvas id="priorityChart"></canvas>
              </div>
            ) : (
              <div class="h-64 flex items-center justify-center text-neutral-500">
                No test case data available
              </div>
            )}
          </Card>
        </div>
        
        {/* Trend and Suite Performance */}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Execution Trend */}
          <Card title="Execution Trend" subtitle="Daily test executions (last 30 days)">
            {trendData.length > 0 ? (
              <div class="chart-container">
                <canvas id="trendLineChart"></canvas>
              </div>
            ) : (
              <div class="h-64 flex items-center justify-center text-neutral-500">
                No trend data available
              </div>
            )}
          </Card>
          
          {/* Suite Performance */}
          <Card title="Suite Performance" subtitle="Pass rates for recent test suites">
            {suiteStats.length > 0 ? (
              <div class="space-y-4">
                {suiteStats.map((suite, index) => (
                  <div key={index} class="flex items-center gap-4">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-neutral-900 truncate">{suite.name}</p>
                      <p class="text-xs text-neutral-500">{suite.passed} of {suite.total} passed</p>
                    </div>
                    <div class="w-32">
                      <div class="h-2 bg-neutral-200 rounded-full overflow-hidden">
                        <div 
                          class="h-full bg-success-500 rounded-full" 
                          style={`width: ${suite.passRate}%`}
                        />
                      </div>
                    </div>
                    <span class="text-sm font-medium text-neutral-900 w-12 text-right">
                      {suite.passRate}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div class="h-64 flex items-center justify-center text-neutral-500">
                No suite data available
              </div>
            )}
          </Card>
        </div>
        
        {/* Test Cases Table with Filters and Column Customization */}
        <Card title="Test Cases Report" subtitle={`${allTestCases.length} test case(s) found`}>
          <div 
            x-data={`{
              columns: {
                id: true,
                title: true,
                priority: true,
                status: true,
                automated: true,
                folder: true,
                author: true,
                created: true
              },
              showColumnMenu: false
            }`}
          >
            {/* Filters and Column Toggle */}
            <div class="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b border-neutral-200">
              <form method="GET" action="/reports" class="flex flex-wrap items-center gap-3 flex-1">
                {/* Priority Filter */}
                <select 
                  name="priority" 
                  class="px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  onchange="this.form.submit()"
                >
                  <option value="">All Priorities</option>
                  <option value="Critical" selected={priorityFilter === 'Critical'}>Critical</option>
                  <option value="High" selected={priorityFilter === 'High'}>High</option>
                  <option value="Medium" selected={priorityFilter === 'Medium'}>Medium</option>
                  <option value="Low" selected={priorityFilter === 'Low'}>Low</option>
                </select>
                
                {/* Status Filter */}
                <select 
                  name="status" 
                  class="px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  onchange="this.form.submit()"
                >
                  <option value="">All Statuses</option>
                  <option value="Draft" selected={statusFilter === 'Draft'}>Draft</option>
                  <option value="Active" selected={statusFilter === 'Active'}>Active</option>
                  <option value="Deprecated" selected={statusFilter === 'Deprecated'}>Deprecated</option>
                </select>
                
                {/* Automated Filter */}
                <select 
                  name="automated" 
                  class="px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  onchange="this.form.submit()"
                >
                  <option value="">All Types</option>
                  <option value="true" selected={automatedFilter === 'true'}>Automated</option>
                  <option value="false" selected={automatedFilter === 'false'}>Manual</option>
                </select>
                
                {(priorityFilter || statusFilter || automatedFilter) && (
                  <a href="/reports" class="text-sm text-primary-600 hover:text-primary-700">
                    Clear Filters
                  </a>
                )}
              </form>
              
              {/* Column Toggle Button */}
              <div class="relative">
                <button
                  type="button"
                  x-on:click="showColumnMenu = !showColumnMenu"
                  class="flex items-center gap-2 px-3 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50"
                >
                  <span dangerouslySetInnerHTML={{ __html: icons.columns }} />
                  Columns
                </button>
                
                {/* Column Menu Dropdown */}
                <div 
                  x-show="showColumnMenu" 
                  {...{"x-on:click.away": "showColumnMenu = false"}}
                  class="absolute right-0 mt-2 w-48 bg-white border border-neutral-200 rounded-lg shadow-strong z-10"
                >
                  <div class="p-2 space-y-1">
                    <label class="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer">
                      <input type="checkbox" x-model="columns.id" class="rounded text-primary-600" />
                      <span class="text-sm">ID</span>
                    </label>
                    <label class="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer">
                      <input type="checkbox" x-model="columns.title" class="rounded text-primary-600" />
                      <span class="text-sm">Title</span>
                    </label>
                    <label class="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer">
                      <input type="checkbox" x-model="columns.priority" class="rounded text-primary-600" />
                      <span class="text-sm">Priority</span>
                    </label>
                    <label class="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer">
                      <input type="checkbox" x-model="columns.status" class="rounded text-primary-600" />
                      <span class="text-sm">Status</span>
                    </label>
                    <label class="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer">
                      <input type="checkbox" x-model="columns.automated" class="rounded text-primary-600" />
                      <span class="text-sm">Automated</span>
                    </label>
                    <label class="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer">
                      <input type="checkbox" x-model="columns.folder" class="rounded text-primary-600" />
                      <span class="text-sm">Folder</span>
                    </label>
                    <label class="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer">
                      <input type="checkbox" x-model="columns.author" class="rounded text-primary-600" />
                      <span class="text-sm">Author</span>
                    </label>
                    <label class="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer">
                      <input type="checkbox" x-model="columns.created" class="rounded text-primary-600" />
                      <span class="text-sm">Created</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Table */}
            {allTestCases.length > 0 ? (
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-neutral-200">
                      <th x-show="columns.id" class="text-left py-3 px-2 font-medium text-neutral-700">ID</th>
                      <th x-show="columns.title" class="text-left py-3 px-2 font-medium text-neutral-700">Title</th>
                      <th x-show="columns.priority" class="text-left py-3 px-2 font-medium text-neutral-700">Priority</th>
                      <th x-show="columns.status" class="text-left py-3 px-2 font-medium text-neutral-700">Status</th>
                      <th x-show="columns.automated" class="text-left py-3 px-2 font-medium text-neutral-700">Type</th>
                      <th x-show="columns.folder" class="text-left py-3 px-2 font-medium text-neutral-700">Folder</th>
                      <th x-show="columns.author" class="text-left py-3 px-2 font-medium text-neutral-700">Author</th>
                      <th x-show="columns.created" class="text-left py-3 px-2 font-medium text-neutral-700">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTestCases.map(({ testCase, folder, author }) => (
                      <tr key={testCase.id} class="border-b border-neutral-100 hover:bg-neutral-50">
                        <td x-show="columns.id" class="py-3 px-2">
                          <a href={`/test-case/${testCase.id}`} class="font-mono text-primary-600 hover:text-primary-700">
                            {generateTestCaseId(testCase.id)}
                          </a>
                        </td>
                        <td x-show="columns.title" class="py-3 px-2">
                          <a href={`/test-case/${testCase.id}`} class="text-neutral-900 hover:text-primary-600">
                            {testCase.title}
                          </a>
                        </td>
                        <td x-show="columns.priority" class="py-3 px-2">
                          <Badge variant={testCase.priority === 'Critical' ? 'danger' : testCase.priority === 'High' ? 'danger' : testCase.priority === 'Medium' ? 'warning' : 'neutral'}>
                            {testCase.priority || 'Medium'}
                          </Badge>
                        </td>
                        <td x-show="columns.status" class="py-3 px-2">
                          <Badge variant={testCase.status === 'Active' ? 'success' : testCase.status === 'Deprecated' ? 'neutral' : 'info'}>
                            {testCase.status || 'Draft'}
                          </Badge>
                        </td>
                        <td x-show="columns.automated" class="py-3 px-2">
                          <span class={`text-xs px-2 py-0.5 rounded ${testCase.isAutomated ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600'}`}>
                            {testCase.isAutomated ? 'Automated' : 'Manual'}
                          </span>
                        </td>
                        <td x-show="columns.folder" class="py-3 px-2 text-neutral-600">
                          {folder?.name || '-'}
                        </td>
                        <td x-show="columns.author" class="py-3 px-2 text-neutral-600">
                          {author?.fullName || author?.email || '-'}
                        </td>
                        <td x-show="columns.created" class="py-3 px-2 text-neutral-500 text-xs">
                          {formatDate(testCase.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div class="py-12 text-center text-neutral-500">
                No test cases match the current filters
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Chart.js Initialization */}
      <script dangerouslySetInnerHTML={{ __html: `
        document.addEventListener('DOMContentLoaded', function() {
          const statusData = ${JSON.stringify(statusData)};
          const priorityData = ${JSON.stringify(priorityData)};
          const trendData = ${JSON.stringify(trendData)};
          
          const statusColors = {
            'Passed': '#22c55e',
            'Failed': '#ef4444',
            'Blocked': '#f59e0b',
            'Not Run': '#a3a3a3',
            'In Progress': '#3b82f6',
          };
          
          const priorityColors = {
            'High': '#ef4444',
            'Medium': '#f59e0b',
            'Low': '#22c55e',
          };
          
          // Status Pie Chart
          if (statusData.length > 0) {
            const statusCtx = document.getElementById('statusPieChart');
            if (statusCtx) {
              new Chart(statusCtx, {
                type: 'pie',
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
                    legend: { position: 'bottom' }
                  }
                }
              });
            }
          }
          
          // Priority Bar Chart
          if (priorityData.length > 0) {
            const priorityCtx = document.getElementById('priorityChart');
            if (priorityCtx) {
              new Chart(priorityCtx, {
                type: 'bar',
                data: {
                  labels: priorityData.map(d => d.priority),
                  datasets: [{
                    label: 'Test Cases',
                    data: priorityData.map(d => d.count),
                    backgroundColor: priorityData.map(d => priorityColors[d.priority] || '#a3a3a3'),
                    borderRadius: 8,
                  }]
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false }
                  },
                  scales: {
                    y: { beginAtZero: true }
                  }
                }
              });
            }
          }
          
          // Trend Line Chart
          if (trendData.length > 0) {
            const trendCtx = document.getElementById('trendLineChart');
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
                    legend: { display: false }
                  },
                  scales: {
                    y: { beginAtZero: true }
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

