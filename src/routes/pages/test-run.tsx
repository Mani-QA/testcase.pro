import type { Context } from 'hono';
import type { Bindings } from '../../types';
import { Layout } from '../../components/Layout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { StatusBadge } from '../../components/StatusBadge';
import { TestSuiteCard } from '../../components/TestSuiteCard';
import { createDb } from '../../db';
import { testSuites, testRunEntries, testCases, testCaseSteps, testRunStepResults, users } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { generateTestCaseId, formatDate } from '../../lib/utils';

const icons = {
  plus: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>`,
  play: `<svg class="w-16 h-16 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
};

export async function testRunListPage(c: Context<{ Bindings: Bindings }>) {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  
  // Get all test suites with stats
  const suites = await db
    .select({
      suite: testSuites,
      creator: users,
    })
    .from(testSuites)
    .leftJoin(users, eq(testSuites.createdBy, users.id))
    .orderBy(sql`${testSuites.createdAt} DESC`);
  
  const suitesWithStats = await Promise.all(
    suites.map(async ({ suite, creator }) => {
      const stats = await db
        .select({
          status: testRunEntries.status,
          count: sql<number>`count(*)`,
        })
        .from(testRunEntries)
        .where(eq(testRunEntries.testSuiteId, suite.id))
        .groupBy(testRunEntries.status);
      
      const total = stats.reduce((sum, s) => sum + Number(s.count), 0);
      const passed = Number(stats.find(s => s.status === 'Passed')?.count || 0);
      const failed = Number(stats.find(s => s.status === 'Failed')?.count || 0);
      const blocked = Number(stats.find(s => s.status === 'Blocked')?.count || 0);
      const notRun = Number(stats.find(s => s.status === 'Not Run')?.count || 0);
      
      return {
        ...suite,
        creator: creator ? { id: creator.id, fullName: creator.fullName, email: creator.email } : null,
        stats: { total, passed, failed, blocked, notRun },
      };
    })
  );
  
  const canEdit = !!user;
  
  return c.html(
    <Layout user={user} currentPath="/test-run" title="Test Run">
      <div class="p-4 sm:p-6 lg:p-8">
        <div class="max-w-4xl mx-auto">
          {/* Header */}
          <div class="flex items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
            <div>
              <h1 class="text-xl sm:text-2xl font-bold text-neutral-900">Test Run</h1>
              <p class="text-xs sm:text-sm text-neutral-500 mt-0.5 sm:mt-1">
                Execute and track your test suites
              </p>
            </div>
            
            {canEdit && (
              <a 
                href="/test-run/create"
                class="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 shadow-sm transition-all flex-shrink-0"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                <span class="hidden sm:inline">New Test Suite</span>
                <span class="sm:hidden">New</span>
              </a>
            )}
          </div>
          
          {/* Test Suites List */}
          <div id="test-suites-list">
            {suitesWithStats.length === 0 ? (
              <div class="bg-white rounded-xl border border-neutral-200 p-8 sm:p-12 text-center">
                <div class="w-12 h-12 sm:w-16 sm:h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <svg class="w-6 h-6 sm:w-8 sm:h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <h3 class="text-base sm:text-lg font-semibold text-neutral-900 mb-2">
                  No test suites yet
                </h3>
                <p class="text-sm text-neutral-500 mb-4 sm:mb-6 max-w-sm mx-auto">
                  {canEdit
                    ? 'Create your first test suite to start executing and tracking test cases'
                    : 'Sign in to create test suites'
                  }
                </p>
                {canEdit && (
                  <a 
                    href="/test-run/create"
                    class="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 shadow-sm transition-all"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Create Test Suite
                  </a>
                )}
              </div>
            ) : (
              <div class="space-y-3 sm:space-y-4">
                {suitesWithStats.map((suite) => (
                  <TestSuiteCard key={suite.id} suite={suite} canEdit={canEdit} />
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export async function testRunExecutePage(c: Context<{ Bindings: Bindings }>) {
  const user = c.get('user');
  const db = createDb(c.env.DB);
  const suiteId = parseInt(c.req.param('id'));
  
  // Get suite with entries
  const [suite] = await db
    .select({
      suite: testSuites,
      creator: users,
    })
    .from(testSuites)
    .leftJoin(users, eq(testSuites.createdBy, users.id))
    .where(eq(testSuites.id, suiteId))
    .limit(1);
  
  if (!suite) {
    return c.html(
      <Layout user={user} currentPath="/test-run" title="Test Suite Not Found">
        <div class="p-8 max-w-4xl mx-auto">
          <Card>
            <div class="text-center py-12">
              <h3 class="text-lg font-semibold text-neutral-900 mb-2">Test Suite Not Found</h3>
              <Button variant="primary" href="/test-run">Back to Test Runs</Button>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }
  
  // Get entries with test case details
  const entries = await db
    .select({
      entry: testRunEntries,
      testCase: testCases,
    })
    .from(testRunEntries)
    .leftJoin(testCases, eq(testRunEntries.testCaseId, testCases.id))
    .where(eq(testRunEntries.testSuiteId, suiteId));
  
  // Get steps and step results for each entry
  const entriesWithSteps = await Promise.all(
    entries.map(async ({ entry, testCase }) => {
      const steps = testCase ? await db
        .select()
        .from(testCaseSteps)
        .where(eq(testCaseSteps.testCaseId, testCase.id))
        .orderBy(testCaseSteps.stepNumber) : [];
      
      const stepResults = await db
        .select()
        .from(testRunStepResults)
        .where(eq(testRunStepResults.testRunEntryId, entry.id))
        .orderBy(testRunStepResults.stepNumber);
      
      // Merge steps with their results
      const stepsWithResults = steps.map(step => {
        const result = stepResults.find(r => r.stepNumber === step.stepNumber);
        return {
          ...step,
          resultStatus: result?.status || 'Not Run',
          actualResult: result?.actualResult || '',
        };
      });
      
      return { entry, testCase, steps: stepsWithResults };
    })
  );
  
  // Get stats
  const stats = await db
    .select({
      status: testRunEntries.status,
      count: sql<number>`count(*)`,
    })
    .from(testRunEntries)
    .where(eq(testRunEntries.testSuiteId, suiteId))
    .groupBy(testRunEntries.status);
  
  const total = stats.reduce((sum, s) => sum + Number(s.count), 0);
  const passed = Number(stats.find(s => s.status === 'Passed')?.count || 0);
  const failed = Number(stats.find(s => s.status === 'Failed')?.count || 0);
  const blocked = Number(stats.find(s => s.status === 'Blocked')?.count || 0);
  
  const canEdit = !!user;
  
  return c.html(
    <Layout user={user} currentPath="/test-run" title={suite.suite.title}>
      <div class="p-4 sm:p-6 lg:p-8">
        <div class="max-w-5xl mx-auto">
        {/* Header */}
        <div class="mb-4 sm:mb-6">
          <div class="flex items-center gap-2 text-xs sm:text-sm text-neutral-500 mb-2">
            <a href="/test-run" class="hover:text-primary-600">Test Runs</a>
            <span>/</span>
            <span class="text-primary-600 truncate max-w-[150px] sm:max-w-none">{suite.suite.title}</span>
          </div>
          
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <h1 class="text-xl sm:text-2xl lg:text-3xl font-bold text-neutral-900 mb-1 sm:mb-2">{suite.suite.title}</h1>
              <div class="flex flex-wrap items-center gap-2 sm:gap-4">
                <StatusBadge status={suite.suite.status || 'In Progress'} />
                <span class="text-sm text-neutral-600">
                  {passed + failed + blocked} of {total} executed
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Progress */}
        <Card className="mb-4 sm:mb-6">
          <div class="flex items-center justify-between mb-3 sm:mb-4">
            <h3 class="text-base sm:text-lg font-semibold text-neutral-900">Execution Progress</h3>
            <span class="text-xs sm:text-sm text-neutral-600">
              {total > 0 ? Math.round(((passed + failed + blocked) / total) * 100) : 0}% Complete
            </span>
          </div>
          <div class="h-2.5 sm:h-3 bg-neutral-200 rounded-full overflow-hidden flex">
            {passed > 0 && (
              <div class="bg-success-500 h-full" style={`width: ${(passed / total) * 100}%`} />
            )}
            {failed > 0 && (
              <div class="bg-danger-500 h-full" style={`width: ${(failed / total) * 100}%`} />
            )}
            {blocked > 0 && (
              <div class="bg-warning-500 h-full" style={`width: ${(blocked / total) * 100}%`} />
            )}
          </div>
          {/* Mobile: 2x2 grid, Desktop: horizontal */}
          <div class="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-6 mt-3 sm:mt-4 text-xs sm:text-sm">
            <span class="flex items-center gap-1.5 sm:gap-2">
              <span class="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-success-500"></span>
              Passed: {passed}
            </span>
            <span class="flex items-center gap-1.5 sm:gap-2">
              <span class="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-danger-500"></span>
              Failed: {failed}
            </span>
            <span class="flex items-center gap-1.5 sm:gap-2">
              <span class="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-warning-500"></span>
              Blocked: {blocked}
            </span>
            <span class="flex items-center gap-1.5 sm:gap-2">
              <span class="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-neutral-300"></span>
              Not Run: {total - passed - failed - blocked}
            </span>
          </div>
        </Card>
        
        {/* Test Entries */}
        <div class="space-y-3 sm:space-y-4">
          {entriesWithSteps.map(({ entry, testCase, steps }) => (
            <Card key={entry.id} padding={false}>
              <div 
                x-data={`{ 
                  expanded: false, 
                  status: '${entry.status}', 
                  actualResult: '${(entry.actualResult || '').replace(/'/g, "\\'")}',
                  stepResults: ${JSON.stringify(steps.map(s => ({ stepNumber: s.stepNumber, status: s.resultStatus, actualResult: s.actualResult })))},
                  updateStep(stepNum, newStatus) {
                    const step = this.stepResults.find(s => s.stepNumber === stepNum);
                    if (step) step.status = newStatus;
                    this.saveStepResults();
                  },
                  updateStepResult(stepNum, result) {
                    const step = this.stepResults.find(s => s.stepNumber === stepNum);
                    if (step) step.actualResult = result;
                  },
                  saveStepResults() {
                    const allPassed = this.stepResults.every(s => s.status === 'Passed');
                    const anyFailed = this.stepResults.some(s => s.status === 'Failed');
                    const anyBlocked = this.stepResults.some(s => s.status === 'Blocked');
                    if (allPassed && this.stepResults.length > 0) this.status = 'Passed';
                    else if (anyFailed) this.status = 'Failed';
                    else if (anyBlocked) this.status = 'Blocked';
                    else if (this.stepResults.some(s => s.status !== 'Not Run')) this.status = 'In Progress';
                    
                    fetch('/api/test-runs/${entry.id}', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        status: this.status, 
                        actualResult: this.actualResult,
                        stepResults: this.stepResults.map(s => ({
                          stepNumber: s.stepNumber,
                          status: s.status,
                          actualResult: s.actualResult
                        }))
                      })
                    });
                  }
                }`}
                class="border-l-4"
                x-bind:class="{
                  'border-success-500': status === 'Passed',
                  'border-danger-500': status === 'Failed',
                  'border-warning-500': status === 'Blocked',
                  'border-primary-500': status === 'In Progress',
                  'border-neutral-300': status === 'Not Run',
                }"
              >
                <div class="p-3 sm:p-4">
                  <div class="flex items-start sm:items-center justify-between gap-2">
                    <div class="flex items-start sm:items-center gap-2 sm:gap-4 min-w-0 flex-1">
                      <button
                        type="button"
                        x-on:click="expanded = !expanded"
                        class="p-1 hover:bg-neutral-100 rounded flex-shrink-0 mt-0.5 sm:mt-0"
                      >
                        <svg 
                          class="w-4 h-4 sm:w-5 sm:h-5 text-neutral-400 transition-transform" 
                          x-bind:class="expanded ? 'rotate-90' : ''"
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-x-1 sm:gap-x-2 gap-y-0.5">
                          <span class="text-xs sm:text-sm font-mono text-primary-600">
                            {generateTestCaseId(testCase?.id || 0)}
                          </span>
                          <span class="hidden sm:inline text-neutral-400">-</span>
                          <span class="w-full sm:w-auto text-sm sm:text-base font-medium text-neutral-900 truncate">{testCase?.title}</span>
                        </div>
                        {steps.length > 0 && (
                          <span class="text-xs text-neutral-500 mt-0.5 block sm:hidden">
                            {steps.length} step{steps.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Status badge */}
                    <div class="flex flex-col items-end gap-1 flex-shrink-0">
                      <span 
                        class="px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded-full"
                        x-bind:class="{
                          'bg-success-100 text-success-700': status === 'Passed',
                          'bg-danger-100 text-danger-700': status === 'Failed',
                          'bg-warning-100 text-warning-700': status === 'Blocked',
                          'bg-primary-100 text-primary-700': status === 'In Progress',
                          'bg-neutral-100 text-neutral-600': status === 'Not Run',
                        }"
                        x-text="status"
                      >{entry.status || 'Not Run'}</span>
                      {steps.length > 0 && (
                        <span class="hidden sm:block text-xs text-neutral-500">
                          {steps.length} step{steps.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Expanded Content */}
                <div x-show="expanded" x-collapse class="border-t border-neutral-200">
                  <div class="p-3 sm:p-4 bg-neutral-50">
                    {testCase?.description && (
                      <div class="mb-3 sm:mb-4">
                        <h4 class="text-xs sm:text-sm font-medium text-neutral-700 mb-1">Description</h4>
                        <p class="text-xs sm:text-sm text-neutral-600">{testCase.description}</p>
                      </div>
                    )}
                    
                    {testCase?.preConditions && (
                      <div class="mb-3 sm:mb-4">
                        <h4 class="text-xs sm:text-sm font-medium text-neutral-700 mb-1">Pre-Conditions</h4>
                        <p class="text-xs sm:text-sm text-neutral-600">{testCase.preConditions}</p>
                      </div>
                    )}
                    
                    {/* Test Steps */}
                    {steps.length > 0 && (
                      <div class="mb-3 sm:mb-4">
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
                          <h4 class="text-xs sm:text-sm font-medium text-neutral-700">Test Steps</h4>
                          {canEdit && (
                            <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <span class="text-xs text-neutral-500 hidden sm:inline mr-1">Mark All:</span>
                              <button
                                type="button"
                                x-on:click="stepResults.forEach(s => s.status = 'Passed'); status = 'Passed'; saveStepResults()"
                                class="px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded-full transition-all duration-200 flex items-center gap-1"
                                style="background-color: #dcfce7; color: #15803d;"
                                x-bind:style="status === 'Passed' && 'background-color: #22c55e; color: white; box-shadow: 0 2px 4px rgba(34, 197, 94, 0.3);'"
                              >
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" x-show="status === 'Passed'">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                                <span class="hidden sm:inline" x-text="status === 'Passed' ? 'Passed' : 'Pass All'">Pass All</span>
                                <span class="sm:hidden" x-text="status === 'Passed' ? '✓' : 'Pass'">Pass</span>
                              </button>
                              <button
                                type="button"
                                x-on:click="stepResults.forEach(s => s.status = 'Failed'); status = 'Failed'; saveStepResults()"
                                class="px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded-full transition-all duration-200 flex items-center gap-1"
                                style="background-color: #fee2e2; color: #b91c1c;"
                                x-bind:style="status === 'Failed' && 'background-color: #ef4444; color: white; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);'"
                              >
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" x-show="status === 'Failed'">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span class="hidden sm:inline" x-text="status === 'Failed' ? 'Failed' : 'Fail'">Fail</span>
                                <span class="sm:hidden" x-text="status === 'Failed' ? '✗' : 'Fail'">Fail</span>
                              </button>
                              <button
                                type="button"
                                x-on:click="stepResults.forEach(s => s.status = 'Blocked'); status = 'Blocked'; saveStepResults()"
                                class="px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded-full transition-all duration-200 flex items-center gap-1"
                                style="background-color: #fef3c7; color: #b45309;"
                                x-bind:style="status === 'Blocked' && 'background-color: #f59e0b; color: white; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);'"
                              >
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" x-show="status === 'Blocked'">
                                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                </svg>
                                <span class="hidden sm:inline" x-text="status === 'Blocked' ? 'Blocked' : 'Block'">Block</span>
                                <span class="sm:hidden" x-text="status === 'Blocked' ? '⏸' : 'Block'">Block</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <div class="space-y-2 sm:space-y-3">
                          {steps.map((step, index) => (
                            <div 
                              key={step.id} 
                              class="bg-white rounded-lg border border-neutral-200 overflow-hidden"
                              x-bind:class={`{
                                '!border-success-300 !bg-success-50/30': stepResults[${index}]?.status === 'Passed',
                                '!border-danger-300 !bg-danger-50/30': stepResults[${index}]?.status === 'Failed',
                                '!border-warning-300 !bg-warning-50/30': stepResults[${index}]?.status === 'Blocked'
                              }`}
                            >
                              {/* Mobile: Stacked layout, Desktop: Side by side */}
                              <div class="flex flex-col sm:flex-row sm:items-stretch">
                                {/* Step Number - Horizontal bar on mobile, vertical on desktop */}
                                <div 
                                  class="flex sm:w-10 sm:flex-shrink-0 items-center justify-between sm:justify-center p-2 sm:p-0 border-b sm:border-b-0 sm:border-r border-neutral-200 transition-all duration-200"
                                  style="background-color: #f5f5f5;"
                                  x-bind:style={`{
                                    'background-color': stepResults[${index}]?.status === 'Passed' ? '#dcfce7' : stepResults[${index}]?.status === 'Failed' ? '#fee2e2' : stepResults[${index}]?.status === 'Blocked' ? '#fef3c7' : '#f5f5f5'
                                  }`}
                                >
                                  <span 
                                    class="text-xs sm:text-sm font-bold transition-colors"
                                    style="color: #525252;"
                                    x-bind:style={`{
                                      'color': stepResults[${index}]?.status === 'Passed' ? '#15803d' : stepResults[${index}]?.status === 'Failed' ? '#b91c1c' : stepResults[${index}]?.status === 'Blocked' ? '#b45309' : '#525252'
                                    }`}
                                  >
                                    Step {step.stepNumber}
                                  </span>
                                  
                                  {/* Mobile: Inline status buttons */}
                                  <div class="flex sm:hidden items-center gap-1">
                                    {canEdit ? (
                                      <>
                                        <button
                                          type="button"
                                          x-on:click={`updateStep(${step.stepNumber}, 'Passed')`}
                                          class="w-8 h-8 text-xs font-medium rounded-full transition-all duration-200 flex items-center justify-center"
                                          style="background-color: #dcfce7; color: #15803d;"
                                          x-bind:style={`stepResults[${index}]?.status === 'Passed' && 'background-color: #22c55e; color: white;'`}
                                        >
                                          ✓
                                        </button>
                                        <button
                                          type="button"
                                          x-on:click={`updateStep(${step.stepNumber}, 'Failed')`}
                                          class="w-8 h-8 text-xs font-medium rounded-full transition-all duration-200 flex items-center justify-center"
                                          style="background-color: #fee2e2; color: #b91c1c;"
                                          x-bind:style={`stepResults[${index}]?.status === 'Failed' && 'background-color: #ef4444; color: white;'`}
                                        >
                                          ✗
                                        </button>
                                        <button
                                          type="button"
                                          x-on:click={`updateStep(${step.stepNumber}, 'Blocked')`}
                                          class="w-8 h-8 text-xs font-medium rounded-full transition-all duration-200 flex items-center justify-center"
                                          style="background-color: #fef3c7; color: #b45309;"
                                          x-bind:style={`stepResults[${index}]?.status === 'Blocked' && 'background-color: #f59e0b; color: white;'`}
                                        >
                                          ⏸
                                        </button>
                                      </>
                                    ) : (
                                      <StatusBadge status={step.resultStatus || 'Not Run'} />
                                    )}
                                  </div>
                                </div>
                                
                                {/* Content */}
                                <div class="flex-1 p-2.5 sm:p-3">
                                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-2">
                                    <div>
                                      <div class="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-0.5 sm:mb-1">Action</div>
                                      <div class="text-xs sm:text-sm text-neutral-800">{step.action}</div>
                                    </div>
                                    <div>
                                      <div class="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-0.5 sm:mb-1">Expected Result</div>
                                      <div class="text-xs sm:text-sm text-neutral-600">{step.expectedResult || '-'}</div>
                                    </div>
                                  </div>
                                  
                                  {/* Actual Result */}
                                  {canEdit && (
                                    <div class="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-neutral-100">
                                      <div class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                                        <span class="text-xs font-medium text-neutral-400 whitespace-nowrap flex items-center gap-1">
                                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                          </svg>
                                          Actual Result
                                        </span>
                                        <input
                                          type="text"
                                          placeholder="Enter actual result..."
                                          x-model={`stepResults[${index}].actualResult`}
                                          x-on:blur="saveStepResults()"
                                          class="w-full sm:flex-1 px-3 py-1.5 text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 sm:border-0 rounded-lg sm:rounded-full focus:ring-2 focus:ring-primary-200 focus:bg-white placeholder-neutral-400"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Desktop: Result Buttons - Hidden on mobile */}
                                <div class="hidden sm:flex w-24 flex-shrink-0 flex-col gap-1.5 p-2 border-l border-neutral-200 bg-neutral-50/30 justify-center">
                                  {canEdit ? (
                                    <>
                                      <button
                                        type="button"
                                        x-on:click={`updateStep(${step.stepNumber}, 'Passed')`}
                                        class="px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-200 flex items-center justify-center gap-1"
                                        style="background-color: #dcfce7; color: #15803d;"
                                        x-bind:style={`stepResults[${index}]?.status === 'Passed' && 'background-color: #22c55e; color: white; box-shadow: 0 1px 3px rgba(34, 197, 94, 0.4);'`}
                                      >
                                        <svg 
                                          class="w-3 h-3" 
                                          fill="none" 
                                          stroke="currentColor" 
                                          viewBox="0 0 24 24"
                                          x-show={`stepResults[${index}]?.status === 'Passed'`}
                                        >
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span x-text={`stepResults[${index}]?.status === 'Passed' ? 'Passed' : 'Pass'`}>Pass</span>
                                      </button>
                                      <button
                                        type="button"
                                        x-on:click={`updateStep(${step.stepNumber}, 'Failed')`}
                                        class="px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-200 flex items-center justify-center gap-1"
                                        style="background-color: #fee2e2; color: #b91c1c;"
                                        x-bind:style={`stepResults[${index}]?.status === 'Failed' && 'background-color: #ef4444; color: white; box-shadow: 0 1px 3px rgba(239, 68, 68, 0.4);'`}
                                      >
                                        <svg 
                                          class="w-3 h-3" 
                                          fill="none" 
                                          stroke="currentColor" 
                                          viewBox="0 0 24 24"
                                          x-show={`stepResults[${index}]?.status === 'Failed'`}
                                        >
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        <span x-text={`stepResults[${index}]?.status === 'Failed' ? 'Failed' : 'Fail'`}>Fail</span>
                                      </button>
                                      <button
                                        type="button"
                                        x-on:click={`updateStep(${step.stepNumber}, 'Blocked')`}
                                        class="px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-200 flex items-center justify-center gap-1"
                                        style="background-color: #fef3c7; color: #b45309;"
                                        x-bind:style={`stepResults[${index}]?.status === 'Blocked' && 'background-color: #f59e0b; color: white; box-shadow: 0 1px 3px rgba(245, 158, 11, 0.4);'`}
                                      >
                                        <svg 
                                          class="w-3 h-3" 
                                          fill="currentColor" 
                                          viewBox="0 0 24 24"
                                          x-show={`stepResults[${index}]?.status === 'Blocked'`}
                                        >
                                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                        </svg>
                                        <span x-text={`stepResults[${index}]?.status === 'Blocked' ? 'Blocked' : 'Block'`}>Block</span>
                                      </button>
                                    </>
                                  ) : (
                                    <div class="flex items-center justify-center">
                                      <StatusBadge status={step.resultStatus || 'Not Run'} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Overall Notes */}
                    {canEdit && (
                      <div class="bg-white rounded-lg border border-neutral-200 p-3 sm:p-4">
                        <label class="block text-xs sm:text-sm font-medium text-neutral-700 mb-1.5 sm:mb-2">
                          Overall Notes
                        </label>
                        <textarea
                          x-model="actualResult"
                          x-on:blur="saveStepResults()"
                          class="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          rows={2}
                          placeholder="Enter overall notes or comments..."
                        >{entry.actualResult || ''}</textarea>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
        </div>
      </div>
    </Layout>
  );
}

export async function testRunCreatePage(c: Context<{ Bindings: Bindings }>) {
  const user = c.get('user');
  
  if (!user) {
    return c.redirect('/auth/signin');
  }
  
  const db = createDb(c.env.DB);
  
  // Get all test cases
  const allTestCases = await db
    .select({ testCase: testCases })
    .from(testCases);
  
  return c.html(
    <Layout user={user} currentPath="/test-run" title="Create Test Suite">
      <div class="p-8 max-w-4xl mx-auto">
        <div class="mb-6">
          <h1 class="text-3xl font-bold text-neutral-900 mb-2">Create Test Suite</h1>
          <p class="text-neutral-600">Select test cases to include in your test run</p>
        </div>
        
        <Card>
          <form
            x-data={`{ 
              selectedIds: [], 
              title: '', 
              description: '',
              submitting: false,
              async submit() {
                if (this.submitting) return;
                this.submitting = true;
                try {
                  const response = await fetch('/api/test-suites', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: this.title,
                      description: this.description || null,
                      testCaseIds: this.selectedIds
                    })
                  });
                  if (response.ok) {
                    window.location.href = '/test-run';
                  } else {
                    const error = await response.json();
                    alert('Error: ' + (error.error || 'Failed to create test suite'));
                    this.submitting = false;
                  }
                } catch (e) {
                  alert('Error creating test suite');
                  this.submitting = false;
                }
              }
            }`}
            {...{"x-on:submit.prevent": "submit()"}}
            class="space-y-6"
          >
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-2">
                Suite Title <span class="text-danger-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                x-model="title"
                required
                class="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., Regression Test - Sprint 23"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                x-model="description"
                rows={2}
                class="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Optional description"
              ></textarea>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-2">
                Select Test Cases <span class="text-danger-500">*</span>
              </label>
              <p class="text-sm text-neutral-500 mb-3">
                <span x-text="selectedIds.length"></span> test case(s) selected
              </p>
              
              <div class="border border-neutral-200 rounded-lg max-h-96 overflow-y-auto">
                {allTestCases.map(({ testCase }) => (
                  <label
                    key={testCase.id}
                    class="flex items-center gap-3 p-3 hover:bg-neutral-50 border-b border-neutral-100 last:border-b-0 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      x-on:change={`selectedIds.includes(${testCase.id}) ? selectedIds = selectedIds.filter(id => id !== ${testCase.id}) : selectedIds.push(${testCase.id})`}
                      class="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                    />
                    <div class="flex-1">
                      <span class="text-sm font-mono text-primary-600 mr-2">
                        {generateTestCaseId(testCase.id)}
                      </span>
                      <span class="text-sm font-medium text-neutral-900">{testCase.title}</span>
                    </div>
                    <Badge variant={testCase.priority === 'High' ? 'danger' : testCase.priority === 'Medium' ? 'warning' : 'neutral'}>
                      {testCase.priority || 'Medium'}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>
            
            <div class="flex justify-end gap-3 pt-4 border-t border-neutral-200">
              <Button variant="ghost" href="/test-run">Cancel</Button>
              <button 
                type="submit" 
                class="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                x-bind:disabled="selectedIds.length === 0 || title.trim() === '' || submitting"
              >
                <span x-show="!submitting">Create Test Suite</span>
                <span x-show="submitting">Creating...</span>
              </button>
            </div>
          </form>
        </Card>
      </div>
    </Layout>
  );
}

